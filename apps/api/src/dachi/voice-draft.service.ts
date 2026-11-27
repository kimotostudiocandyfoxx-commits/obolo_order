import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { pickVoiceMood, timed, type LlmProvider } from '@obolo/ai';
import { clampVoiceTune, isDefaultVoiceTune, VOICE_MAX_BYTES, VOICE_MIME_TYPES, VOICE_MIX_CAP_WORDS, VOICE_TUNE_DEFAULT, VOICE_TUNE_KEY, voiceMixCapped, voiceTuneOf, type DachiVoiceDraft, type VoiceMood, type VoicePreviewBody, type VoiceSoundPick, type VoiceTune, type VoiceTuneBody, type VoiceTuneView } from '@obolo/shared';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { CONFIG, type AppConfig } from '../config';
import { Database } from '../db/db';
import { dachiMessages, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV, LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { canUseMedia } from '../voice/media-consent';
import { cleanVoice, mixVoice, NoVoiceError, type CleanVoice } from '../voice/voice-mix';
import { accessDay } from '../wallet/access.service';
import { costScope } from '../wallet/cost-scope';

/**
 * Client 2026-11-27 (the ダチ voice message trial, shared/voiceSound.ts): a recording made ready to send.
 *
 *  draft   — the recording is made ready in the member's voice settings (voice/voice-mix.ts; the default is sample K:
 *            clean, the silences cut, a light pitch correction, 1.8× and +6 semitones), kept as the member's voice
 *            (through the media service), heard as words (the caption: from the clean take before the cut and the
 *            change, so the settings do not touch the words) and given a sound from the words.
 *  tune    — the member's voice settings (shared voiceTune.ts; users.onboarding_json['voice.dachi']), changed by
 *            talking to {bati}; tunePreview — the last take's first seconds in settings (nothing kept). For that the
 *            last take is kept clean and whole as one file per member (replaced by the next one; the pointer in KV).
 *  preview — the mix with a chosen sound, as bytes (〔▶ きいてみる〕): nothing is kept.
 *  mixFor  — the mix that is sent, kept beside the clean voice (the receiver's 〔おとをけす〕 plays the clean one).
 *  discard — a draft thrown away (〔けす〕, a new take): its file goes.
 *
 * Who: only a member whose voice may be used (canUseMedia — never under 13; the web sends words instead and nothing is
 * recorded). How many: VOICE_MIX_DAILY_CAP a day. What it costs (our CPU seconds, the words, the mood — about ¥0.03) is
 * the member's small cost 'voiceMix' (wallet/cost-scope.ts featureOfPath; not absorbed like the rest of the ダチ talk).
 */
/** how long the last take waits for a preview (the file goes when the next take comes, or with the member's files) */
const TAKE_TTL_SEC = 30 * 86400;
/** 〔きいてみる〕 hears this much of the last take (seconds of the recording, before the cut and the speed) */
const TUNE_PREVIEW_SEC = 12;

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
  /** the member's voice settings as kept (none: the default) */
  protected async tuneOf(userId: string): Promise<VoiceTune> {
    const [u] = await this.db.write.select({ j: users.onboardingJson }).from(users).where(eq(users.id, userId));
    return voiceTuneOf(u?.j);
  }
  /** keeps them (the default is kept as no entry) */
  protected async saveTune(userId: string, tune: VoiceTune): Promise<void> {
    const [u] = await this.db.write.select({ j: users.onboardingJson }).from(users).where(eq(users.id, userId));
    const json = { ...((u?.j ?? {}) as Record<string, string>) };
    if (isDefaultVoiceTune(tune)) delete json[VOICE_TUNE_KEY];
    else json[VOICE_TUNE_KEY] = JSON.stringify(tune);
    await this.db.write.update(users).set({ onboardingJson: json, updatedAt: new Date() }).where(eq(users.id, userId));
  }
  protected clean(input: Buffer, tune: VoiceTune, maxSec?: number): Promise<CleanVoice> {
    return timed('cpu', 'voice-clean', () => cleanVoice(input, tune, { python: this.cfg.VOICE_TUNE_PYTHON, timeoutMs: this.cfg.VOICE_TUNE_TIMEOUT_MS, maxSec }));
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

  /** counts one draft of today; past the cap a calm 429 */
  async countToday(userId: string, now = new Date()): Promise<void> {
    const n = await this.kv.incr(`voice-mix:${userId}:${accessDay(now)}`, 2 * 86400);
    if (voiceMixCapped(n, this.cfg.VOICE_MIX_DAILY_CAP)) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'VOICE_MIX_CAP', VOICE_MIX_CAP_WORDS);
  }

  async draft(userId: string, mimeHeader: string | undefined, body: unknown, origin: string): Promise<DachiVoiceDraft> {
    const mime = (mimeHeader ?? '').split(';')[0].trim().toLowerCase();
    if (!(VOICE_MIME_TYPES as readonly string[]).includes(mime)) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_AUDIO', `Unsupported audio type: ${mime || 'none'}`);
    if (!Buffer.isBuffer(body) || body.length === 0) throw apiError(HttpStatus.BAD_REQUEST, 'EMPTY_UPLOAD', 'No audio received');
    if (body.length > VOICE_MAX_BYTES) throw apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'Audio file too large');
    // never under 13 (and only with the agreement): the recording is refused before anything is read or kept
    if (!(await this.mayRecord(userId))) throw apiError(HttpStatus.FORBIDDEN, 'VOICE_NOT_ALLOWED', 'The voice is not recorded for this member');
    await this.countToday(userId);
    let clean: CleanVoice;
    try {
      clean = await this.clean(body, await this.tuneOf(userId));
    } catch (e) {
      // nothing but silence in the take: said like a take that was too short (「もう少し長く、話してね」), never sent as it is
      if (e instanceof NoVoiceError) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VOICE_SILENT', 'No voice in this recording');
      this.log.warn(`clean failed (${mime}, ${body.length} bytes): ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    // kept, and heard as words, at the same time; a voice that cannot be heard as words is still a voice message
    const [stored, text] = await Promise.all([
      this.media.storeVoice(userId, 'audio/mpeg', clean.mp3, origin),
      this.llm?.transcribe
        ? this.llm.transcribe(clean.heard, 'audio/mp3').then(
            (t) => t.replace(/\s+/g, ' ').trim().slice(0, 300),
            (e: unknown) => (this.log.warn(`words failed: ${String(e)}`), ''),
          )
        : Promise.resolve(''),
    ]);
    const pick = await pickVoiceMood(this.llm, text);
    // the take clean and whole, for 〔きいてみる〕 after a change of the voice settings (one per member)
    await this.keepTake(userId, clean.heard, origin).catch((e: unknown) => this.log.warn(`last take not kept: ${String(e)}`));
    return { mediaId: stored.id, url: stored.url, seconds: clean.seconds, text, sound: pick.sound, soft: !!pick.soft };
  }

  // ── the member's voice settings (shared voiceTune.ts) ──

  private takeKey(userId: string) {
    return `voice-take:${userId}`;
  }
  /** the last take, clean and whole: the new one in, the one before out */
  private async keepTake(userId: string, heard: Buffer, origin: string): Promise<void> {
    const before = await this.kv.get(this.takeKey(userId));
    const kept = await this.media.storeVoice(userId, 'audio/mpeg', heard, origin);
    await this.kv.set(this.takeKey(userId), kept.id, TAKE_TTL_SEC);
    if (before && before !== kept.id) {
      const old = await this.media.getOwned(userId, before, 'voice');
      if (old) await this.media.removeByUrl(userId, old.url);
    }
  }
  private async lastTake(userId: string): Promise<Buffer | null> {
    const id = await this.kv.get(this.takeKey(userId)).catch(() => null);
    return id ? ((await this.media.imageData(userId, id, 'voice'))?.data ?? null) : null;
  }

  async tune(userId: string): Promise<VoiceTuneView> {
    const tune = await this.tuneOf(userId);
    return { tune, isDefault: isDefaultVoiceTune(tune), hasTake: !!(await this.kv.get(this.takeKey(userId)).catch(() => null)) };
  }

  /** the parts given change, inside the limits whatever was sent; `reset` = the default. Only a member who is recorded has them. */
  async setTune(userId: string, b: VoiceTuneBody): Promise<VoiceTuneView> {
    if (!(await this.mayRecord(userId))) throw apiError(HttpStatus.FORBIDDEN, 'VOICE_NOT_ALLOWED', 'The voice is not recorded for this member');
    const next = b.reset ? { ...VOICE_TUNE_DEFAULT } : clampVoiceTune(b, await this.tuneOf(userId));
    await this.saveTune(userId, next);
    return { tune: next, isDefault: isDefaultVoiceTune(next), hasTake: !!(await this.kv.get(this.takeKey(userId)).catch(() => null)) };
  }

  /** 〔きいてみる〕: the first seconds of the last take in the settings of now (MP3 bytes; nothing kept) */
  async tunePreview(userId: string): Promise<Buffer> {
    if (!(await this.mayRecord(userId))) throw apiError(HttpStatus.FORBIDDEN, 'VOICE_NOT_ALLOWED', 'The voice is not recorded for this member');
    const take = await this.lastTake(userId);
    if (!take) throw apiError(HttpStatus.NOT_FOUND, 'NO_TAKE', 'No recording to try the settings on yet');
    try {
      return (await this.clean(take, await this.tuneOf(userId), TUNE_PREVIEW_SEC)).mp3;
    } catch (e) {
      this.log.warn(`tune preview failed: ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not make this preview');
    }
  }

  private async voiceBytes(userId: string, mediaId: string): Promise<Buffer> {
    const v = await this.media.imageData(userId, mediaId, 'voice');
    if (!v) throw apiError(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Recording not found');
    return v.data;
  }

  /** 〔▶ きいてみる〕: the mix as it would be sent (MP3 bytes; 'none' = the clean voice itself) */
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
