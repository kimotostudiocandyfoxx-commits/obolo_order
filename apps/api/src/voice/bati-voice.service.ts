import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { BATI_VOICE_BASE_SEMITONES, BATI_VOICE_MAX_SECONDS, BATI_VOICE_MIN_SECONDS, batiDefaultVoice, batiVoiceTuning, type BatiVoiceBody, type Me } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { CONFIG, type AppConfig } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { JobPayloads, JobQueue } from '../infra/queue';
import { QUEUE } from '../infra/tokens';
import { activeBati, batiList } from '../look/batis';
import { MediaService } from '../media/media.service';
import { toMe } from '../users/users.service';
import { toMp3 } from './audio';
import { canUseMedia } from './media-consent';
import { VOICE_MODELS, type VoiceModels } from './voice-models';

export { canUseMedia, hasMediaConsent } from './media-consent';

type User = typeof users.$inferSelect;
type Patch = Partial<Pick<User, 'voiceBatiId' | 'voiceBatiUrl' | 'voiceBatiState'>>;

/**
 * {bati}'s voice from the egg recording (M-R246 / M-R247, D03-S005 「たまごに声を聞かせる」).
 *  - POST /voice/bati: the held takes (appended) are kept as one recording (media service, audio kind) and a queued job
 *    ('voice.bati') makes a private voice model from it pitched up BATI_VOICE_BASE_SEMITONES (+2). Shorter than
 *    BATI_VOICE_MIN_SECONDS → VOICE_TOO_SHORT (the egg asks for more: 「、、、もう少し、聞かせてやれ。」).
 *  - No start-of-app consent, not allowed by age (M-R248: under 13 never, 13〜15 with the guardian's consent), or no voice
 *    service: nothing is kept, no model is made — {bati} has the default voice.
 *    The job checks the consent again before it makes the model.
 *  - DELETE /voice/bati (〔声を消す〕): the recording and the model are deleted; back to the default voice.
 *  - speak(): a text in the member's {bati} voice; the 2nd / 3rd {bati} with its personality's small change.
 * The voice is used for {bati}'s voice only.
 */
@Injectable()
export class BatiVoiceService implements OnModuleInit {
  private readonly log = new Logger('BatiVoice');
  /** ffmpeg (kept on the instance so tests can stand in for it) */
  convert: (input: Buffer, semitones: number) => Promise<Buffer> = (input, semitones) => toMp3(input, semitones, BATI_VOICE_MAX_SECONDS);

  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(QUEUE) private readonly queue: JobQueue,
    @Inject(VOICE_MODELS) private readonly models: VoiceModels,
    /** FISH_DEFAULT_VOICE_ID: the shared default {bati} voice model (iPad feedback; scripts/make-default-bati-voice.ts) */
    @Inject(CONFIG) private readonly cfg: Pick<AppConfig, 'FISH_DEFAULT_VOICE_ID'> = {},
  ) {}

  onModuleInit() {
    this.queue.register('voice.bati', (p) => this.make(p));
  }

  protected async row(userId: string): Promise<User | null> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    return u ?? null;
  }

  protected async save(userId: string, patch: Patch): Promise<User> {
    const [nu] = await this.db.write
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return nu;
  }

  async record(userId: string, body: BatiVoiceBody, origin: string): Promise<Me> {
    const u = await this.row(userId);
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    // without the agreement (or with no voice service here) nothing is kept: {bati} keeps the default voice
    if (!canUseMedia(u) || !this.models.enabled) {
      this.log.log(`bati voice not kept for ${userId}: ${!canUseMedia(u) ? 'no consent / age (M-R248)' : 'voice service off'}`);
      return toMe(u);
    }
    if (body.seconds < BATI_VOICE_MIN_SECONDS) throw apiError(HttpStatus.BAD_REQUEST, 'VOICE_TOO_SHORT', 'Talk to the egg a little longer');
    const parts: Buffer[] = [];
    try {
      for (const t of body.takes) parts.push(await this.convert(Buffer.from(t.data, 'base64'), 0));
    } catch (e) {
      this.log.warn(`convert failed: ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    // MP3 frames of one format follow each other as they are: the takes become one recording
    const rec = await this.media.storeAudio(userId, 'audio/mpeg', Buffer.concat(parts), origin);
    const old = u.voiceBatiUrl;
    const nu = await this.save(userId, { voiceBatiUrl: rec.url, voiceBatiState: 'making' });
    if (old && old !== rec.url) void this.media.removeByUrl(userId, old).catch(() => undefined);
    await this.queue.enqueue('voice.bati', { userId, url: rec.url, text: body.text || undefined }, { dedupeKey: `bv-${userId.slice(0, 8)}-${rec.id.slice(0, 8)}` });
    return toMe(nu);
  }

  /** the job: the recording, +2 semitones, → a private voice model; it becomes {bati}'s voice */
  async make(p: JobPayloads['voice.bati']): Promise<void> {
    const u = await this.row(p.userId);
    if (!u || u.voiceBatiUrl !== p.url) return; // deleted or recorded again meanwhile
    if (!canUseMedia(u)) {
      // the agreement (and, by age, the guardian's) is required for a voice model: none is made, the default voice stays
      this.log.warn(`bati voice model refused for ${p.userId}: no consent / age`);
      await this.save(p.userId, { voiceBatiState: 'none' });
      return;
    }
    try {
      const raw = await this.media.audioByUrl(p.userId, p.url);
      if (!raw) throw new Error('the recording is gone');
      const audio = await this.convert(raw, BATI_VOICE_BASE_SEMITONES);
      const id = await this.models.create({ title: `obolo-${p.userId.slice(0, 8)}-bati`, audio, filename: 'bati.mp3', mime: 'audio/mpeg', text: p.text });
      const now = await this.row(p.userId);
      if (!now || now.voiceBatiUrl !== p.url || !canUseMedia(now)) {
        // deleted while it was being made: the new model goes too
        await this.models.remove(id).catch(() => undefined);
        return;
      }
      const old = now.voiceBatiId;
      await this.save(p.userId, { voiceBatiId: id, voiceBatiState: 'ready' });
      if (old && old !== id) void this.models.remove(old).catch(() => undefined);
      this.log.log(`bati voice ready for ${p.userId}`);
    } catch (e) {
      this.log.warn(`bati voice failed for ${p.userId}: ${String(e)}`);
      await this.save(p.userId, { voiceBatiState: 'failed' });
    }
  }

  /** 〔声を消す〕: the recording and the model are deleted; {bati} speaks in the default voice again */
  async remove(userId: string): Promise<Me> {
    const u = await this.row(userId);
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    const nu = await this.save(userId, { voiceBatiId: null, voiceBatiUrl: null, voiceBatiState: 'none' });
    if (u.voiceBatiId) await this.models.remove(u.voiceBatiId).catch((e) => this.log.warn(`delete model: ${String(e)}`));
    if (u.voiceBatiUrl) await this.media.removeByUrl(userId, u.voiceBatiUrl).catch((e) => this.log.warn(`delete recording: ${String(e)}`));
    return toMe(nu);
  }

  /**
   * The Fish voice model {bati} speaks in (iPad feedback): the member's own (from the egg recording, when it may be
   * used) → the prepared one for the egg × personality (BATI_DEFAULT_VOICES.fish, none chosen yet) → the shared
   * default {bati} voice (FISH_DEFAULT_VOICE_ID: the client's recording, +2 semitones). When the member's own model is
   * made (make()), it is used from the next line on — no switch to flip. null: no Fish voice (the caller's fallback).
   */
  voiceRef(u: User | null): string | null {
    if (!u) return this.cfg.FISH_DEFAULT_VOICE_ID ?? null;
    if (u.voiceBatiId && canUseMedia(u)) return u.voiceBatiId;
    const r = activeBati(u);
    return batiDefaultVoice(r?.egg, r?.personality).fish ?? this.cfg.FISH_DEFAULT_VOICE_ID ?? null;
  }

  /**
   * A text in {bati}'s Fish voice (MP3): the member's own, else the default model (voiceRef); null when there is none
   * (the caller uses the Gemini voice). The 1st {bati} speaks in the model as made (+2); the 2nd / 3rd with their
   * personality's pitch and speed on top.
   */
  async speak(userId: string, text: string): Promise<Buffer | null> {
    if (!this.models.enabled) return null;
    const u = await this.row(userId);
    const ref = this.voiceRef(u);
    if (!u || !ref) return null;
    const tune = this.tuning(u);
    const mp3 = await this.models.speak(ref, text, tune.speed);
    return tune.semitones ? this.convert(mp3, tune.semitones) : mp3;
  }

  /** M-R250: the prepared voice for the member's active {bati} (egg × personality), when no own voice is used */
  async defaultVoice(userId: string) {
    const u = await this.row(userId);
    const r = u ? activeBati(u) : null;
    return batiDefaultVoice(r?.egg, r?.personality);
  }

  /** the active {bati}'s change on the base voice (its place among the member's {bati}, its personality) */
  tuning(u: User): { semitones: number; speed: number } {
    const r = activeBati(u);
    if (!r) return { semitones: 0, speed: 1 };
    const nth = batiList(u).findIndex((x) => x.id === r.id) + 1;
    return batiVoiceTuning(nth, r.personality);
  }
}
