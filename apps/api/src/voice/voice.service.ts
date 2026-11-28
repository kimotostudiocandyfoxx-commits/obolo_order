import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type LlmProvider, moderateText } from '@obolo/ai';
import { LLM } from '../infra/tokens';
import { batiSpeakSpeed, batiVoiceSilent, cleanHeard, VOICE_MAX_BYTES, VOICE_MIME_TYPES, VOICE_SCRIPTS, VOICE_STYLES, type Me, type RegisterVoiceBody, type SpeakBody, type VoiceSlot } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users, wallets } from '../db/schema';
import { MediaService } from '../media/media.service';
import { toMe } from '../users/users.service';
import { loudness, toMp3 } from './audio';
import { canUseMedia } from './media-consent';
import { activeBati } from '../look/batis';
import { createVoiceModel, deleteVoiceModel, textToSpeech, type TtsOptions } from './fish.client';
import { batiVoiceId } from './voice-models';

/** one dictated take is at most this long (the web's recorder stops at 45 s) */
export const DICTATE_MAX_SECONDS = 50;

/**
 * Member voices (client decision 2026-10-07): Fish Audio voice models per member — their own voice ('self') and the
 * funny voice of their kororins ('kororin'). Read-aloud (Saturn, Bati's lines) uses Fish TTS (model s2.1-pro); singing
 * uses the same TTS with a leading [singing] tag (ComposeService.sing).
 * M-R342 (client 2026-11-27): the 'bati' slot is no voice of the member's any more — {bati} speaks (and sings) in the
 * fixed voice of its egg (batiVoiceId), for everyone; nothing can be registered for it.
 */
@Injectable()
export class VoiceService {
  private readonly log = new Logger('Voice');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  private key(): string {
    if (!this.cfg.FISH_API_KEY) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'VOICE_OFF', 'The voice service is not connected yet');
    return this.cfg.FISH_API_KEY;
  }

  get connected(): boolean {
    return !!this.cfg.FISH_API_KEY;
  }

  /**
   * The Fish voice for this slot: the member's own model ('self' / 'kororin': throws when not registered), or — 'bati',
   * M-R342 — the fixed voice of their active {bati}'s egg (always there).
   */
  async voiceId(userId: string, slot: VoiceSlot): Promise<string> {
    this.key();
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (slot === 'bati') return batiVoiceId(this.cfg, u ? activeBati(u)?.egg : null);
    const ref = u?.[this.col(slot)];
    if (!ref) throw apiError(HttpStatus.CONFLICT, 'VOICE_NOT_REGISTERED', 'Register this voice first');
    return ref;
  }

  /** Sing (text starting with [singing]) in a voice model. Returns MP3 bytes. */
  sing(referenceId: string, o: Omit<TtsOptions, 'referenceId'>): Promise<Buffer> {
    return textToSpeech(this.key(), this.cfg.FISH_MODEL, { ...o, referenceId });
  }

  private col(slot: Exclude<VoiceSlot, 'bati'>) {
    return slot === 'self' ? 'voiceSelfId' : 'voiceKororinId';
  }

  async register(userId: string, body: RegisterVoiceBody, origin: string): Promise<Me> {
    const key = this.key();
    // M-R342: {bati}'s voice is fixed (its egg's) — no recording becomes it. (users.voice_bati_id is the member's own
    // voice model now, made from the day-2 recording: BatiVoiceService, POST /voice/bati.)
    const slot = body.slot;
    if (slot === 'bati') throw apiError(HttpStatus.BAD_REQUEST, 'BATI_VOICE_FIXED', "The partner's voice is fixed; it cannot be registered");
    const raw = Buffer.from(body.audio.data, 'base64');
    if (raw.length < 5_000) throw apiError(HttpStatus.BAD_REQUEST, 'VOICE_TOO_SHORT', 'The recording is too short');
    let mp3: Buffer;
    try {
      mp3 = await toMp3(raw, body.pitch ?? 0);
    } catch (e) {
      this.log.warn(`convert failed: ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    // M-R247: a voice model needs the start-of-app agreement on what the voice is used for
    // M-R248: and by age (under 13 never; 13〜15 with the guardian's consent)
    if (!canUseMedia(u)) throw apiError(HttpStatus.FORBIDDEN, 'CONSENT_REQUIRED', 'The voice cannot be used for this account');
    const id = await createVoiceModel(key, { title: `obolo-${userId.slice(0, 8)}-${slot}`, audio: mp3, filename: `${slot}.mp3`, mime: 'audio/mpeg', text: body.text ?? VOICE_SCRIPTS[slot] });
    const old = u[this.col(slot)];
    // the recording itself is kept too: songs are sung in it (Seed-VC reference, 2026-10-09)
    const sample = await this.media.storeAudio(userId, 'audio/mpeg', mp3, origin);
    const urlCol = slot === 'self' ? 'voiceSelfUrl' : 'voiceKororinUrl';
    const oldSample = u[urlCol];
    const [nu] = await this.db.write
      .update(users)
      .set({ [this.col(slot)]: id, [urlCol]: sample.url, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (old && old !== id) void deleteVoiceModel(key, old);
    if (oldSample && oldSample !== sample.url) void this.media.removeByUrl(userId, oldSample).catch(() => undefined);
    this.log.log(`voice ${slot} registered for ${userId}`);
    return toMe(nu);
  }

  /**
   * Speech → text from one of the member's own recordings (mic first: the recording is the
   * post's voice, its words fill the text box). Converted to MP3 for the model.
   */
  async transcribe(userId: string, mediaId: string): Promise<{ text: string }> {
    const src = await this.media.imageData(userId, mediaId, 'voice');
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Recording not found');
    if (!this.llm.transcribe) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'STT_OFF', 'Speech to text is not available');
    let mp3: Buffer;
    try {
      mp3 = await toMp3(src.data);
    } catch (e) {
      this.log.warn(`stt convert failed: ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    try {
      // no speech in it: no words rather than the model's 「00:00」 / 「[ノイズ]」 (shared heardText)
      const text = cleanHeard(await this.llm.transcribe(mp3, 'audio/mp3')).slice(0, 600);
      return { text };
    } catch (e) {
      this.log.warn(`stt failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'STT_FAILED', 'Could not turn the voice into text');
    }
  }

  /**
   * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」): the words of what was just said, for the browsers that
   * cannot hear by themselves (Chrome / Firefox / Edge on iPhone and the in-app browsers have no speech recognition;
   * apps/web/lib/mic/hear.ts records and sends the take here). The same way as transcribe() — ffmpeg → MP3 → the
   * model — but the recording comes in the request and is NOT stored: it is turned into words and dropped.
   * iPhone sends audio/mp4, Chrome / Firefox audio/webm (VOICE_MIME_TYPES).
   */
  async dictate(mimeHeader: string | undefined, body: unknown): Promise<{ text: string }> {
    const mime = (mimeHeader ?? '').split(';')[0].trim().toLowerCase();
    if (!(VOICE_MIME_TYPES as readonly string[]).includes(mime)) throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_AUDIO', `Unsupported audio type: ${mime || 'none'}`);
    if (!Buffer.isBuffer(body) || body.length === 0) throw apiError(HttpStatus.BAD_REQUEST, 'EMPTY_UPLOAD', 'No audio received');
    if (body.length > VOICE_MAX_BYTES) throw apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE', 'Audio file too large');
    if (!this.llm.transcribe) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'STT_OFF', 'Speech to text is not available');
    let mp3: Buffer;
    try {
      mp3 = await toMp3(body, 0, DICTATE_MAX_SECONDS);
    } catch (e) {
      this.log.warn(`dictate convert failed (${mime}, ${body.length} bytes): ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    let raw: string;
    try {
      raw = await this.llm.transcribe(mp3, 'audio/mp3');
    } catch (e) {
      this.log.warn(`dictate failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'STT_FAILED', 'Could not turn the voice into text');
    }
    // R21 playtest (iPhone Safari): a take with no voice came back as 「00:00」 / noise and stood in the answer — the
    // model's marks for "no speech" are taken out (shared heardText), and such a take is logged with its loudness, so
    // the logs tell a silent recording (the phone gave no sound) from a voice the model could not hear
    const text = cleanHeard(raw).slice(0, 600);
    if (!text) {
      const vol = await loudness(mp3);
      this.log.warn(`dictate no speech (${mime}, ${body.length} bytes, model ${JSON.stringify(raw.trim().slice(0, 40))}, mean ${vol?.meanDb ?? '?'} dB, max ${vol?.maxDb ?? '?'} dB)`);
    }
    return { text };
  }

  async speak(userId: string, body: SpeakBody, origin: string): Promise<{ url: string; mediaId: string }> {
    const key = this.key();
    if ((await moderateText(body.text)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be read aloud');
    if (body.slot === 'bati') {
      // M-R342: {bati}'s fixed voice, under the same rule as a post read by {bati} (after the first journey, no voice
      // at 0 mana) — the caller falls back to the device's reading voice
      const v = await this.readByBati(userId, body, origin);
      if (!v) throw apiError(HttpStatus.CONFLICT, 'NO_VOICE_NOW', "The partner's voice is not available now");
      return v;
    }
    return this.readAloud(userId, body, origin, key);
  }

  /**
   * Read an already-moderated text in a registered voice, in one of the Saturn reading styles
   * (元気に → [excited], ささやき風 → [whispering] … plus the style's speed). Stored on Bunny.
   */
  async readAloud(userId: string, body: SpeakBody, origin: string, key = this.key()): Promise<{ url: string; mediaId: string }> {
    return this.readWith(await this.voiceId(userId, body.slot), userId, body, origin, key);
  }

  /**
   * Bati reads a post (M-R342): in the fixed voice of the member's active {bati}'s egg, at {bati}'s speed; null when
   * the voice service is off or the mana rule below says no voice (the caller falls back to the device voice).
   */
  async readByBati(userId: string, body: Omit<SpeakBody, 'slot'>, origin: string): Promise<{ url: string; mediaId: string } | null> {
    if (!this.cfg.FISH_API_KEY) return null;
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    // M-R342, one rule for everyone (shared batiVoiceSilent): after the first journey, no voice with no mana left
    // (the caller's fallback, the device's reading voice, costs nothing); during the journey everyone hears {bati}
    if (u && batiVoiceSilent({ journeyDay: u.journeyDay ?? 1, journeyCompletedAt: u.journeyCompletedAt ?? null, balance: await this.balance(userId) })) return null;
    return this.readWith(batiVoiceId(this.cfg, u ? activeBati(u)?.egg : null), userId, { ...body, slot: 'bati' }, origin, this.key());
  }

  /** the member's mana now (stubbed in tests) */
  protected async balance(userId: string): Promise<number> {
    const [w] = await this.db.write.select({ b: wallets.manaBalance }).from(wallets).where(eq(wallets.userId, userId));
    return w?.b ?? 0;
  }

  private async readWith(ref: string, userId: string, body: SpeakBody, origin: string, key: string): Promise<{ url: string; mediaId: string }> {
    const style = VOICE_STYLES.find((s) => s.id === body.style);
    // M-R342: {bati} speaks at its own speed (1.3×, the pitch stays), the reading style's speed on top
    const speed = body.slot === 'bati' ? batiSpeakSpeed(style?.fish.speed ?? 1, this.cfg.BATI_VOICE_SPEED) : style?.fish.speed;
    const mp3 = await textToSpeech(key, this.cfg.FISH_MODEL, {
      text: style ? `${style.fish.tag} ${body.text}`.trim() : body.text,
      referenceId: ref,
      ...(speed ? { prosody: { speed, volume: 0 } } : {}),
    });
    const m = await this.media.storeAudio(userId, 'audio/mpeg', mp3, origin);
    return { url: m.url, mediaId: m.id };
  }
}
