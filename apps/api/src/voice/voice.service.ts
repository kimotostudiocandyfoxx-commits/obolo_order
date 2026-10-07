import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { moderateText } from '@obolo/ai';
import { VOICE_SCRIPTS, type Me, type RegisterVoiceBody, type SpeakBody, type VoiceSlot } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { spawn } from 'node:child_process';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import { MediaService } from '../media/media.service';
import { toMe } from '../users/users.service';
import { createVoiceModel, deleteVoiceModel, textToSpeech, type TtsOptions } from './fish.client';

/** Any browser recording (webm / mp4 / …) → 44.1 kHz mono MP3 with ffmpeg, trimmed to 30 s. */
function toMp3(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-t', '30', '-ac', '1', '-ar', '44100', '-b:a', '128k', '-f', 'mp3', 'pipe:1']);
    const out: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 && out.length ? resolve(Buffer.concat(out)) : reject(new Error(err.slice(-300) || `ffmpeg ${code}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

/**
 * Member voices (client decision 2026-10-07): two Fish Audio voice models per member — their own
 * voice and the changed voice they give Bati. Read-aloud (Saturn, Bati's lines) uses Fish TTS
 * (model s2.1-pro); singing uses the same TTS with a leading [singing] tag (ComposeService.sing).
 */
@Injectable()
export class VoiceService {
  private readonly log = new Logger('Voice');
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    private readonly media: MediaService,
  ) {}

  private key(): string {
    if (!this.cfg.FISH_API_KEY) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'VOICE_OFF', 'The voice service is not connected yet');
    return this.cfg.FISH_API_KEY;
  }

  /** The member's Fish voice model for this slot (throws when not registered). */
  async voiceId(userId: string, slot: VoiceSlot): Promise<string> {
    this.key();
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    const ref = u?.[this.col(slot)];
    if (!ref) throw apiError(HttpStatus.CONFLICT, 'VOICE_NOT_REGISTERED', 'Register this voice first');
    return ref;
  }

  /** Sing (text starting with [singing]) in a voice model. Returns MP3 bytes. */
  sing(referenceId: string, o: Omit<TtsOptions, 'referenceId'>): Promise<Buffer> {
    return textToSpeech(this.key(), this.cfg.FISH_MODEL, { ...o, referenceId });
  }

  private col(slot: VoiceSlot) {
    return slot === 'self' ? 'voiceSelfId' : 'voiceBatiId';
  }

  async register(userId: string, body: RegisterVoiceBody): Promise<Me> {
    const key = this.key();
    const raw = Buffer.from(body.audio.data, 'base64');
    if (raw.length < 5_000) throw apiError(HttpStatus.BAD_REQUEST, 'VOICE_TOO_SHORT', 'The recording is too short');
    let mp3: Buffer;
    try {
      mp3 = await toMp3(raw);
    } catch (e) {
      this.log.warn(`convert failed: ${String(e)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'BAD_AUDIO', 'Could not read this recording');
    }
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    const id = await createVoiceModel(key, { title: `obolo-${userId.slice(0, 8)}-${body.slot}`, audio: mp3, filename: `${body.slot}.mp3`, mime: 'audio/mpeg', text: VOICE_SCRIPTS[body.slot] });
    const old = u[this.col(body.slot)];
    const [nu] = await this.db.write
      .update(users)
      .set({ [this.col(body.slot)]: id, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (old && old !== id) void deleteVoiceModel(key, old);
    this.log.log(`voice ${body.slot} registered for ${userId}`);
    return toMe(nu);
  }

  async speak(userId: string, body: SpeakBody, origin: string): Promise<{ url: string }> {
    const key = this.key();
    if ((await moderateText(body.text)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be read aloud');
    const ref = await this.voiceId(userId, body.slot);
    const mp3 = await textToSpeech(key, this.cfg.FISH_MODEL, { text: body.text, referenceId: ref });
    const m = await this.media.storeAudio(userId, 'audio/mpeg', mp3, origin);
    return { url: m.url };
  }
}
