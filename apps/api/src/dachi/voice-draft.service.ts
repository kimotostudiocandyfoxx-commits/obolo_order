import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { pickVoiceMood, timed, type LlmProvider } from '@obolo/ai';
import {
  clampVoiceTune,
  isDefaultVoiceTune,
  VOICE_MAX_BYTES,
  VOICE_MIME_TYPES,
  VOICE_MIX_CAP_WORDS,
  VOICE_TUNE_DEFAULT,
  VOICE_TUNE_KEY,
  VOICE_VERSION_DEFAULT,
  VOICE_VERSION_KEY,
  voiceMixCapped,
  voiceTuneOf,
  voiceVersionOf,
  type DachiVoiceDraft,
  type VoiceMood,
  type VoicePreviewBody,
  type VoiceSoundPick,
  type VoiceTune,
  type VoiceTuneBody,
  type VoiceTuneView,
  type VoiceVersion,
} from '@obolo/shared';
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { CONFIG, type AppConfig } from '../config';
import { Database } from '../db/db';
import { dachiMessages, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV, LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { canUseMedia } from '../voice/media-consent';
import { cleanVoice, heardVoice, mixVoice, NoVoiceError, type CleanVoice } from '../voice/voice-mix';
import { accessDay } from '../wallet/access.service';
import { costScope } from '../wallet/cost-scope';

/**
 * Client 2026-11-27 (the ダチ voice message, shared/voiceSound.ts, voiceTune.ts, voiceVersion.ts): a take made ready to
 * send.
 *
 *  draft   — as 「そのまま」 ('asis'): the recording is made ready in the member's voice settings (voice/voice-mix.ts; the
 *            default is sample K at +2 semitones: clean, the silences cut, a light pitch correction, 1.8×), kept as the
 *            member's voice (through the media service), heard as words (the caption: from the clean take before the
 *            cut and the change, so the settings do not touch the words) and given a sound from the words.
 *            As 「きれい」 ('clean'): the take is only heard as words (and its sound picked from them) — nothing of it is
 *            kept; the voice is read from the caption at the send (cute-voice.service.ts).
 *  version — which of the two the member sends, remembered (users.onboarding_json['voice.dachi.version']).
 *  tune    — the member's voice settings (users.onboarding_json['voice.dachi']), changed by talking to {bati}.
 *  mixFor  — the mix that is sent, kept beside the clean voice (the receiver's 〔おとをけす〕 plays the clean one).
 *  discard — a draft thrown away (〔とりなおす〕, the other version chosen): its file goes.
 *
 *  preview — the 「そのまま」 draft with a chosen sound, as bytes (〔▶ きいてみる〕): nothing is kept. Never for 「きれい」:
 *            there is no file, and its voice is the paid one, made only at the send.
 *
 * The sender hears their own voice (client 2026-11-27, late — "the sender does not hear it" was that evening's decision,
 * taken back before it was released): on the draft card (preview) and in the talk. What stays gone is the voice
 * settings' trial on the "last take", and the last take itself: what was kept of it on 2026-11-27 goes per member at
 * their next take or settings turn (forgetTake), and for everyone by the admin's one-off sweep (sweepTakes).
 *
 * Who: only a member whose voice may be used (canUseMedia — never under 13; the web sends words instead and nothing is
 * recorded). How many: VOICE_MIX_DAILY_CAP a day. What it costs (our CPU seconds, the words, the mood — a few hundredths
 * of a yen) is the member's small cost 'voiceMix' (wallet/cost-scope.ts featureOfPath; not absorbed like the rest of
 * the ダチ talk): added up per member and taken a whole mana at a time.
 */
@Injectable()
export class DachiVoiceDraftService {
  private readonly log = new Logger('DachiVoiceDraft');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: Pick<AppConfig, 'VOICE_MIX_DAILY_CAP'> & Partial<Pick<AppConfig, 'VOICE_TUNE_PYTHON' | 'VOICE_TUNE_TIMEOUT_MS'>>,
    @Optional() @Inject(LLM) private readonly llm?: LlmProvider,
  ) {}

  // ── stubbed in tests ──

  /** the member's voice may be recorded and kept (the agreement and the age: never under 13) */
  protected async mayRecord(userId: string): Promise<boolean> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    return canUseMedia(u);
  }
  /** what is kept with the member (onboarding_json): the voice settings and the version they send */
  protected async kept(userId: string): Promise<Record<string, string>> {
    const [u] = await this.db.write.select({ j: users.onboardingJson }).from(users).where(eq(users.id, userId));
    return { ...((u?.j ?? {}) as Record<string, string>) };
  }
  /** one entry of it set, or taken away (null) */
  protected async keep(userId: string, key: string, value: string | null): Promise<void> {
    const json = await this.kept(userId);
    if (value === null) delete json[key];
    else json[key] = value;
    await this.db.write.update(users).set({ onboardingJson: json, updatedAt: new Date() }).where(eq(users.id, userId));
  }
  protected clean(input: Buffer, tune: VoiceTune): Promise<CleanVoice> {
    return timed('cpu', 'voice-clean', () => cleanVoice(input, tune, { python: this.cfg.VOICE_TUNE_PYTHON, timeoutMs: this.cfg.VOICE_TUNE_TIMEOUT_MS }));
  }
  /** the take clean and whole, only to be heard as words (「きれい」) */
  protected hear(input: Buffer): Promise<Buffer> {
    return timed('cpu', 'voice-hear', () => heardVoice(input));
  }
  protected mix(voice: Buffer, pick: VoiceSoundPick & { sound: VoiceMood }) {
    return timed('cpu', 'voice-mix', () => mixVoice(voice, pick));
  }
  /** a message already carries this file (as its voice, or as the voice under its sound) */
  protected async inUse(mediaId: string): Promise<boolean> {
    const [m] = await this.db.write
      .select({ id: dachiMessages.id })
      .from(dachiMessages)
      .where(and(isNull(dachiMessages.deletedAt), or(eq(dachiMessages.audioMediaId, mediaId), sql`${dachiMessages.workJson} -> 'sound' ->> 'plainMediaId' = ${mediaId}`)))
      .limit(1);
    return !!m;
  }
  /** a page of member ids in order, after `after` (the sweep) */
  protected async userIds(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db.read.select({ id: users.id }).from(users).where(after ? gt(users.id, after) : undefined).orderBy(asc(users.id)).limit(limit);
    return rows.map((r) => r.id);
  }

  /** counts one draft of today; past the cap a calm 429 */
  async countToday(userId: string, now = new Date()): Promise<void> {
    const n = await this.kv.incr(`voice-mix:${userId}:${accessDay(now)}`, 2 * 86400);
    if (voiceMixCapped(n, this.cfg.VOICE_MIX_DAILY_CAP)) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'VOICE_MIX_CAP', VOICE_MIX_CAP_WORDS);
  }

  private async words(heard: Buffer): Promise<string> {
    if (!this.llm?.transcribe) return '';
    return this.llm.transcribe(heard, 'audio/mp3').then(
      (t) => t.replace(/\s+/g, ' ').trim().slice(0, 300),
      (e: unknown) => (this.log.warn(`words failed: ${String(e)}`), ''),
    );
  }

  /**
   * A take made ready. `as`: the version asked for (the button on the draft card); left out, the member's remembered
   * one. `cleanOn`: 「きれい」 can be made here (the voice service, a voice to read in) — when not, the take is made
   * 「そのまま」 whatever was remembered or asked.
   */
  async draft(userId: string, mimeHeader: string | undefined, body: unknown, origin: string, o: { as?: VoiceVersion; cleanOn?: boolean } = {}): Promise<Omit<DachiVoiceDraft, 'clean'>> {
    const mime = (mimeHeader ?? '').split(';')[0].trim().toLowerCase();
    if (!(VOICE_MIME_TYPES as readonly string[]).includes(mime)) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_AUDIO', `Unsupported audio type: ${mime || 'none'}`);
    if (!Buffer.isBuffer(body) || body.length === 0) throw apiError(HttpStatus.BAD_REQUEST, 'EMPTY_UPLOAD', 'No audio received');
    if (body.length > VOICE_MAX_BYTES) throw apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'Audio file too large');
    // never under 13 (and only with the agreement): the recording is refused before anything is read or kept
    if (!(await this.mayRecord(userId))) throw apiError(HttpStatus.FORBIDDEN, 'VOICE_NOT_ALLOWED', 'The voice is not recorded for this member');
    await this.countToday(userId);
    // the "last take" kept on 2026-11-27 for the settings' trial is not kept any more: this member's goes now
    void this.forgetTake(userId).catch((e: unknown) => this.log.warn(`last take not removed: ${String(e)}`));
    const kept = await this.kept(userId);
    const version: VoiceVersion = o.cleanOn ? (o.as ?? voiceVersionOf(kept)) : 'asis';
    if (version === 'clean') {
      // 「きれい」: the take is heard as words and gone — nothing of it is kept; the voice is read at the send
      let heard: Buffer;
      try {
        heard = await this.hear(body);
      } catch (e) {
        this.log.warn(`hear failed (${mime}, ${body.length} bytes): ${String(e)}`);
        throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
      }
      const text = await this.words(heard);
      const pick = await pickVoiceMood(this.llm, text);
      return { version, mediaId: null, seconds: 0, text, sound: pick.sound, soft: !!pick.soft };
    }
    let clean: CleanVoice;
    try {
      clean = await this.clean(body, voiceTuneOf(kept));
    } catch (e) {
      // nothing but silence in the take: said like a take that was too short (「もう少し長く、話してね」), never sent as it is
      if (e instanceof NoVoiceError) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VOICE_SILENT', 'No voice in this recording');
      this.log.warn(`clean failed (${mime}, ${body.length} bytes): ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    // kept, and heard as words, at the same time; a voice that cannot be heard as words is still a voice message
    const [stored, text] = await Promise.all([this.media.storeVoice(userId, 'audio/mpeg', clean.mp3, origin), this.words(clean.heard)]);
    const pick = await pickVoiceMood(this.llm, text);
    return { version, mediaId: stored.id, seconds: clean.seconds, text, sound: pick.sound, soft: !!pick.soft };
  }

  // ── the version the member sends (shared voiceVersion.ts) ──

  async version(userId: string): Promise<VoiceVersion> {
    return voiceVersionOf(await this.kept(userId));
  }
  /** remembered (the default is kept as no entry). Only a member who is recorded has the choice. */
  async setVersion(userId: string, version: VoiceVersion): Promise<VoiceVersion> {
    if (!(await this.mayRecord(userId))) throw apiError(HttpStatus.FORBIDDEN, 'VOICE_NOT_ALLOWED', 'The voice is not recorded for this member');
    await this.keep(userId, VOICE_VERSION_KEY, version === VOICE_VERSION_DEFAULT ? null : version);
    return version;
  }

  // ── the member's voice settings (shared voiceTune.ts) ──

  async tune(userId: string): Promise<VoiceTuneView> {
    const tune = voiceTuneOf(await this.kept(userId));
    return { tune, isDefault: isDefaultVoiceTune(tune) };
  }

  /** the parts given change, inside the limits whatever was sent; `reset` = the default. Only a member who is recorded has them. */
  async setTune(userId: string, b: VoiceTuneBody): Promise<VoiceTuneView> {
    if (!(await this.mayRecord(userId))) throw apiError(HttpStatus.FORBIDDEN, 'VOICE_NOT_ALLOWED', 'The voice is not recorded for this member');
    const next = b.reset ? { ...VOICE_TUNE_DEFAULT } : clampVoiceTune(b, voiceTuneOf(await this.kept(userId)));
    // the default is kept as no entry: 「もとにもどす」 follows the default wherever it is
    await this.keep(userId, VOICE_TUNE_KEY, isDefaultVoiceTune(next) ? null : JSON.stringify(next));
    void this.forgetTake(userId).catch((e: unknown) => this.log.warn(`last take not removed: ${String(e)}`));
    return { tune: next, isDefault: isDefaultVoiceTune(next) };
  }

  // ── the one-off cleanup of the "last takes" (kept only on 2026-11-27, for a trial the sender no longer has) ──

  private takeKey(userId: string) {
    return `voice-take:${userId}`;
  }
  /** this member's kept last take, if there is one: the file and its pointer go. true: there was one. */
  async forgetTake(userId: string): Promise<boolean> {
    const id = await this.kv.get(this.takeKey(userId));
    if (!id) return false;
    const m = await this.media.getOwned(userId, id, 'voice');
    // (a voice message never carries this file; checked all the same before anything is deleted)
    if (m && !(await this.inUse(id))) await this.media.removeByUrl(userId, m.url);
    await this.kv.del(this.takeKey(userId));
    return true;
  }
  /**
   * POST /admin/voice-takes-cleanup: a page of members looked at (in the order of their ids, after `after`), their
   * kept last take removed. Run again with `next` until it is null. The pointers also end by themselves after 30 days,
   * but the files would stay: this takes both.
   */
  async sweepTakes(after: string | null, limit: number): Promise<{ looked: number; removed: number; next: string | null }> {
    const ids = await this.userIds(after, limit);
    let removed = 0;
    for (const id of ids) if (await this.forgetTake(id).catch((e: unknown) => (this.log.warn(`last take of ${id} not removed: ${String(e)}`), false))) removed++;
    return { looked: ids.length, removed, next: ids.length === limit ? ids[ids.length - 1] : null };
  }

  private async voiceBytes(userId: string, mediaId: string): Promise<Buffer> {
    const v = await this.media.imageData(userId, mediaId, 'voice');
    if (!v) throw apiError(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Recording not found');
    return v.data;
  }

  /** 〔▶ きいてみる〕: the mix as it would be sent (MP3 bytes; 'none' = the made-ready voice itself). Nothing is kept. */
  async preview(userId: string, b: VoicePreviewBody): Promise<Buffer> {
    const voice = await this.voiceBytes(userId, b.mediaId);
    if (b.sound === 'none') return voice;
    try {
      return (await this.mix(voice, { sound: b.sound, soft: b.soft })).mp3;
    } catch (e) {
      this.log.warn(`preview mix failed: ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not mix this recording');
    }
  }

  /**
   * The mix that is sent, kept as a file of its own; null when it cannot be made (the voice goes alone: a message is
   * never lost for its sound). Its cost is the member's small cost 'voiceMix' although the sending itself is 'dachi'.
   */
  async mixFor(userId: string, mediaId: string, pick: VoiceSoundPick & { sound: VoiceMood }, origin: string): Promise<{ id: string; url: string; seconds: number } | null> {
    const scope = costScope.get();
    const work = async () => {
      const m = await this.mix(await this.voiceBytes(userId, mediaId), pick);
      const stored = await this.media.storeVoice(userId, 'audio/mpeg', m.mp3, origin);
      return { id: stored.id, url: stored.url, seconds: m.seconds };
    };
    try {
      return await (scope ? costScope.run({ ...scope, feature: 'voiceMix' }, work) : work());
    } catch (e) {
      this.log.warn(`mix failed (${pick.sound}): ${String(e)}`);
      return null;
    }
  }

  /** a draft thrown away: its file goes — unless a message already carries it */
  async discard(userId: string, mediaId: string): Promise<{ ok: true }> {
    const m = await this.media.getOwned(userId, mediaId, 'voice');
    if (m && !(await this.inUse(mediaId))) await this.media.removeByUrl(userId, m.url);
    return { ok: true };
  }
}
