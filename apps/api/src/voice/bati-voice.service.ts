import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { timed } from '@obolo/ai';
import { BATI_VOICE_MAX_SECONDS, BATI_VOICE_MIN_SECONDS, BATI_VOICE_SPEED, batiDefaultVoice, batiSpeakSpeed, type BatiVoiceBody, type Me } from '@obolo/shared';
import { and, asc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { CONFIG, type AppConfig } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { JobPayloads, JobQueue } from '../infra/queue';
import { QUEUE } from '../infra/tokens';
import { activeBati } from '../look/batis';
import { MediaService } from '../media/media.service';
import { toMe } from '../users/users.service';
import { costScope } from '../wallet/cost-scope';
import { toMp3 } from './audio';
import { canUseMedia } from './media-consent';
import { batiVoiceId, VOICE_MODELS, type BatiVoiceIds, type VoiceModels } from './voice-models';

export { canUseMedia, hasMediaConsent } from './media-consent';

type User = typeof users.$inferSelect;
type Patch = Partial<Pick<User, 'voiceBatiId' | 'voiceBatiUrl' | 'voiceBatiState'>>;

/**
 * users.onboarding_json['voice.unpitched'] = '1': this member's voice model was made from the recording as it is
 * (M-R342). No mark: a model from before, made from the recording pitched up two semitones — remakeOld's work.
 */
export const VOICE_UNPITCHED = 'voice.unpitched';
export const voiceUnpitched = (u: Pick<User, 'onboardingJson'>) => ((u.onboardingJson ?? {}) as Record<string, string>)[VOICE_UNPITCHED] === '1';

/** POST /admin/voice-models-remake: one page */
export interface RemakeResult {
  /** members looked at (those with an old model and a stored recording, in the order of their ids) */
  looked: number;
  remade: number;
  /** not now: the voice may not be used (no current agreement / age) — nothing is sent anywhere; tried again on a later run */
  notAllowed: number;
  /** the stored recording could not be read (gone): left as it is */
  noRecording: number;
  failed: number;
  /** pass as `after` for the next page; null = the end */
  next: string | null;
}

/**
 * Two things that share the day-2 scene (D03-S005 「声を聞かせる」, M-R246 / M-R247) and, since M-R342, nothing else:
 *
 * 1. The member's own voice model (users.voice_bati_id / voice_bati_url / voice_bati_state — the columns keep their old
 *    names; they are the MEMBER's voice now, not {bati}'s). It reads the member's own 「きれい」 ダチ voice messages
 *    (dachi/cute-voice.service.ts).
 *  - POST /voice/bati: the held takes (appended) are kept as one recording (media service, audio kind) and a queued job
 *    ('voice.bati') makes a private voice model from it AS IT IS (no pitch change; before M-R342 it was pitched up two
 *    semitones — the models made then stay as they are). Shorter than BATI_VOICE_MIN_SECONDS → VOICE_TOO_SHORT
 *    (「、、、もう少し、聞かせてやれ。」).
 *  - No start-of-app consent, not allowed by age (M-R248: under 13 never, 13〜15 with the guardian's consent), or no voice
 *    service: nothing is kept, no model is made. The job checks the consent again before it makes the model.
 *  - DELETE /voice/bati (〔声を消す〕): the recording and the model are deleted.
 *
 * 2. {bati}'s voice (M-R342, client 2026-11-27): speak() reads a text in the FIXED Fish voice of the active {bati}'s egg
 *    (♀ Moon / ♂ Sun), at BATI_VOICE_SPEED (1.3×) with the pitch as it is — the same for everyone.
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
    /** {bati}'s fixed voices by egg (FISH_BATI_MOON_VOICE_ID / FISH_BATI_SUN_VOICE_ID) and its speed */
    @Inject(CONFIG) private readonly cfg: BatiVoiceIds & Partial<Pick<AppConfig, 'BATI_VOICE_SPEED'>> = {},
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

  /** the mark of a model made without the pitch change (only that key of onboarding_json is written) */
  protected async mark(userId: string, on: boolean): Promise<void> {
    await this.db.write
      .update(users)
      .set({ onboardingJson: on ? sql`coalesce(${users.onboardingJson}, '{}'::jsonb) || ${JSON.stringify({ [VOICE_UNPITCHED]: '1' })}::jsonb` : sql`coalesce(${users.onboardingJson}, '{}'::jsonb) - ${VOICE_UNPITCHED}` })
      .where(eq(users.id, userId));
  }

  /**
   * the members whose model is an old one: made by make() ('ready') before M-R342 (no mark), with the recording it was
   * made from still stored — a page in the order of their ids. Never a member without a stored recording, never a
   * voice registered another way (no state), never a deleted account.
   */
  protected async oldModels(after: string | null, limit: number): Promise<User[]> {
    return this.db.read
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          isNotNull(users.voiceBatiId),
          isNotNull(users.voiceBatiUrl),
          eq(users.voiceBatiState, 'ready'),
          sql`coalesce(${users.onboardingJson} ->> ${VOICE_UNPITCHED}, '') <> '1'`,
          ...(after ? [gt(users.id, after)] : []),
        ),
      )
      .orderBy(asc(users.id))
      .limit(limit);
  }

  /**
   * M-R342, the operator's one-off (POST /admin/voice-models-remake): the members' voice models made before M-R342 —
   * from the recording pitched up two semitones — made again from the stored recording as it is, `limit` members at a
   * time. Idempotent: a model made (or made again) without the pitch change is marked (VOICE_UNPITCHED) and never
   * looked at again; a failure leaves the old model in place for the next run. The same checks as make(): the voice
   * may be used NOW (the current agreement, the age) — otherwise nothing is sent and the member is left for a later
   * run — and a recording deleted or made again meanwhile wins. The cost (our CPU; Fish's model call is not billed
   * per call in our books) is the operator's: filed under 'voiceRemake' (ABSORBED_FEATURES), never the member's.
   */
  async remakeOld(after: string | null, limit: number): Promise<RemakeResult> {
    const out: RemakeResult = { looked: 0, remade: 0, notAllowed: 0, noRecording: 0, failed: 0, next: null };
    if (!this.models.enabled) return out;
    const rows = await this.oldModels(after, limit);
    for (const u of rows) {
      out.looked++;
      if (!canUseMedia(u)) {
        out.notAllowed++;
        continue;
      }
      const url = u.voiceBatiUrl!;
      const old = u.voiceBatiId!;
      try {
        const done = await costScope.run({ feature: 'voiceRemake', userId: u.id }, async () => {
          const raw = await this.media.audioByUrl(u.id, url);
          if (!raw) return 'noRecording' as const;
          const audio = await timed('cpu', 'voice-remake', () => this.convert(raw, 0));
          const id = await this.models.create({ title: `obolo-${u.id.slice(0, 8)}-own`, audio, filename: 'own.mp3', mime: 'audio/mpeg' });
          const now = await this.row(u.id);
          if (!now || now.voiceBatiUrl !== url || now.voiceBatiId !== old || !canUseMedia(now)) {
            // deleted, recorded again or no longer allowed while it was being made: the new model goes
            await this.models.remove(id).catch(() => undefined);
            return 'failed' as const;
          }
          await this.save(u.id, { voiceBatiId: id });
          await this.mark(u.id, true);
          void this.models.remove(old).catch(() => undefined);
          return 'remade' as const;
        });
        out[done]++;
      } catch (e) {
        this.log.warn(`voice model not remade for ${u.id}: ${String(e)}`);
        out.failed++;
      }
    }
    out.next = rows.length === limit ? rows[rows.length - 1].id : null;
    this.log.log(`voice models remade: ${JSON.stringify(out)}`);
    return out;
  }

  async record(userId: string, body: BatiVoiceBody, origin: string): Promise<Me> {
    const u = await this.row(userId);
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    // without the agreement (or with no voice service here) nothing is kept
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

  /** the job: the recording as it is (M-R342: no pitch change) → the member's private voice model */
  async make(p: JobPayloads['voice.bati']): Promise<void> {
    const u = await this.row(p.userId);
    if (!u || u.voiceBatiUrl !== p.url) return; // deleted or recorded again meanwhile
    if (!canUseMedia(u)) {
      // the agreement (and, by age, the guardian's) is required for a voice model: none is made
      this.log.warn(`bati voice model refused for ${p.userId}: no consent / age`);
      await this.save(p.userId, { voiceBatiState: 'none' });
      return;
    }
    try {
      const raw = await this.media.audioByUrl(p.userId, p.url);
      if (!raw) throw new Error('the recording is gone');
      const audio = await this.convert(raw, 0);
      const id = await this.models.create({ title: `obolo-${p.userId.slice(0, 8)}-own`, audio, filename: 'own.mp3', mime: 'audio/mpeg', text: p.text });
      const now = await this.row(p.userId);
      if (!now || now.voiceBatiUrl !== p.url || !canUseMedia(now)) {
        // deleted while it was being made: the new model goes too
        await this.models.remove(id).catch(() => undefined);
        return;
      }
      const old = now.voiceBatiId;
      await this.save(p.userId, { voiceBatiId: id, voiceBatiState: 'ready' });
      await this.mark(p.userId, true);
      if (old && old !== id) void this.models.remove(old).catch(() => undefined);
      this.log.log(`bati voice ready for ${p.userId}`);
    } catch (e) {
      this.log.warn(`bati voice failed for ${p.userId}: ${String(e)}`);
      await this.save(p.userId, { voiceBatiState: 'failed' });
    }
  }

  /** 〔声を消す〕: the member's recording and voice model are deleted ({bati}'s voice is not theirs: it stays) */
  async remove(userId: string): Promise<Me> {
    const u = await this.row(userId);
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    const nu = await this.save(userId, { voiceBatiId: null, voiceBatiUrl: null, voiceBatiState: 'none' });
    await this.mark(userId, false);
    if (u.voiceBatiId) await this.models.remove(u.voiceBatiId).catch((e) => this.log.warn(`delete model: ${String(e)}`));
    if (u.voiceBatiUrl) await this.media.removeByUrl(userId, u.voiceBatiUrl).catch((e) => this.log.warn(`delete recording: ${String(e)}`));
    return toMe(nu);
  }

  /**
   * The Fish voice {bati} speaks in (M-R342, client 2026-11-27): the FIXED voice of the active {bati}'s egg (♀ Moon /
   * ♂ Sun: batiVoiceId) — for every member, recorded or not, and for the 2nd / 3rd {bati} (its own egg's). The member's
   * own voice model is not {bati}'s voice any more. No {bati} yet: the Moon egg's voice.
   */
  voiceRef(u: User | null): string {
    return batiVoiceId(this.cfg, u ? activeBati(u)?.egg : null);
  }

  /** the Fish voice of this member's active {bati} (voiceRef) */
  async voiceOf(userId: string): Promise<string> {
    return this.voiceRef(await this.row(userId));
  }

  /**
   * A text in {bati}'s Fish voice (MP3), at {bati}'s speed with the pitch as it is; null when the voice service is not
   * connected (the caller uses the Gemini voice).
   */
  async speak(userId: string, text: string): Promise<Buffer | null> {
    if (!this.models.enabled) return null;
    const u = await this.row(userId);
    if (!u) return null;
    // M-R342: 1.3× — Fish's own speed (prosody.speed keeps the pitch)
    return this.models.speak(this.voiceRef(u), text, this.speed());
  }

  /** the speed {bati} speaks at (BATI_VOICE_SPEED; `own`: a reading style's speed on top) */
  speed(own = 1): number {
    return batiSpeakSpeed(own, this.cfg.BATI_VOICE_SPEED ?? BATI_VOICE_SPEED);
  }

  /** M-R250: the Gemini voice for the member's active {bati} (egg × personality), where the Fish voice cannot be made */
  async defaultVoice(userId: string) {
    const u = await this.row(userId);
    const r = u ? activeBati(u) : null;
    return batiDefaultVoice(r?.egg, r?.personality);
  }
}
