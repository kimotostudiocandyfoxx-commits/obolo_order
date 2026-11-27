import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { pickVoiceMood, timed, type LlmProvider } from '@obolo/ai';
import { VOICE_MAX_BYTES, VOICE_MIME_TYPES, VOICE_MIX_CAP_WORDS, voiceMixCapped, type DachiVoiceDraft, type VoiceMood, type VoicePreviewBody, type VoiceSoundPick } from '@obolo/shared';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { CONFIG, type AppConfig } from '../config';
import { Database } from '../db/db';
import { dachiMessages, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV, LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { canUseMedia } from '../voice/media-consent';
import { cleanVoice, mixVoice } from '../voice/voice-mix';
import { accessDay } from '../wallet/access.service';
import { costScope } from '../wallet/cost-scope';

/**
 * Client 2026-11-27 (the ダチ voice message trial, shared/voiceSound.ts): a recording made ready to send.
 *
 *  draft   — the recording is cleaned and made 1.2× faster (ffmpeg, voice/voice-mix.ts), kept as the member's voice
 *            (R2, through the media service), heard as words (the caption) and given a sound from the words.
 *  preview — the mix with a chosen sound, as bytes (〔▶ きいてみる〕): nothing is kept.
 *  mixFor  — the mix that is sent, kept beside the clean voice (the receiver's 〔おとをけす〕 plays the clean one).
 *  discard — a draft thrown away (〔けす〕, a new take): its file goes.
 *
 * Who: only a member whose voice may be used (canUseMedia — never under 13; the web sends words instead and nothing is
 * recorded). How many: VOICE_MIX_DAILY_CAP a day. What it costs (our CPU seconds, the words, the mood — about ¥0.03) is
 * the member's small cost 'voiceMix' (wallet/cost-scope.ts featureOfPath; not absorbed like the rest of the ダチ talk).
 */
@Injectable()
export class DachiVoiceDraftService {
  private readonly log = new Logger('DachiVoiceDraft');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(CONFIG) private readonly cfg: Pick<AppConfig, 'VOICE_MIX_DAILY_CAP'>,
    @Optional() @Inject(LLM) private readonly llm?: LlmProvider,
  ) {}

  // ── stubbed in tests ──

  /** the member's voice may be recorded and kept (the agreement and the age: never under 13) */
  protected async mayRecord(userId: string): Promise<boolean> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    return canUseMedia(u);
  }
  protected clean(input: Buffer) {
    return timed('cpu', 'voice-clean', () => cleanVoice(input));
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
    let clean: { mp3: Buffer; seconds: number };
    try {
      clean = await this.clean(body);
    } catch (e) {
      this.log.warn(`clean failed (${mime}, ${body.length} bytes): ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    // kept, and heard as words, at the same time; a voice that cannot be heard as words is still a voice message
    const [stored, text] = await Promise.all([
      this.media.storeVoice(userId, 'audio/mpeg', clean.mp3, origin),
      this.llm?.transcribe
        ? this.llm.transcribe(clean.mp3, 'audio/mp3').then(
            (t) => t.replace(/\s+/g, ' ').trim().slice(0, 300),
            (e: unknown) => (this.log.warn(`words failed: ${String(e)}`), ''),
          )
        : Promise.resolve(''),
    ]);
    const pick = await pickVoiceMood(this.llm, text);
    return { mediaId: stored.id, url: stored.url, seconds: clean.seconds, text, sound: pick.sound, soft: !!pick.soft };
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
