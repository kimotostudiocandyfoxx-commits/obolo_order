import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { fillNames, speakText, storyVoiceFilter, storyVoicePrompt, type LineVoicesBody, type LineVoicesView, type NameLines } from '@obolo/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { lineVoices } from '../db/schema';
import type { KvStore } from '../infra/kv';
import type { JobPayloads, JobQueue } from '../infra/queue';
import { KV, QUEUE } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { textToSpeech } from './fish.client';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
/** lines one member may have voiced a day (a name changed a few times over a long journey is still far below) */
const DAILY = 300;
/** voices made at once on one server (the voice services refuse bursts) */
const AT_ONCE = 3;
/** {bati}'s answers read aloud at once (M-R179): the quicker model of the same voices */
const BATI_SAYS_MODEL = 'gemini-2.5-flash-preview-tts';

/** raw audio (any format ffmpeg reads, or `inputArgs` for raw PCM) → the story's sound, as MP3 */
function finish(input: Buffer, inputArgs: string[], filter: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...inputArgs, '-i', 'pipe:0', '-af', filter, '-ac', '1', '-b:a', '64k', '-f', 'mp3', 'pipe:1']);
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

/** seconds of one of our MP3s (constant 64 kbit/s; ffprobe cannot time an MP3 that comes through a pipe) */
const seconds = (mp3: Buffer) => (mp3.length * 8) / 64_000;

/**
 * Story lines with the member's names in them (client decision 2026-10-16), voiced in the background in
 * the same character voices and sound as the pre-made lines (@obolo/shared storyVoice). The player asks
 * for the lines of the day it plays; voiced ones come back, the rest are queued (one job per line) and
 * the player asks again a little later. A line whose voice is not ready yet is simply played silent.
 */
@Injectable()
export class LineVoiceService implements OnModuleInit {
  private readonly log = new Logger('LineVoice');
  private list: { at: number; data: NameLines | null } = { at: 0, data: null };
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(QUEUE) private readonly queue: JobQueue,
    private readonly db: Database,
    private readonly media: MediaService,
  ) {}

  onModuleInit() {
    this.queue.register('voice.line', (p) => this.make(p));
  }

  /** name-lines.json from the web app (kept 10 minutes; the last good copy if it cannot be fetched) */
  private async lines(): Promise<NameLines | null> {
    if (this.list.data && Date.now() - this.list.at < 600_000) return this.list.data;
    const url = this.cfg.NAME_LINES_URL ?? `${(this.cfg.WEB_ORIGIN ?? 'https://oboloorder-web.vercel.app').replace(/\/$/, '')}/story/voices/name-lines.json`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) this.list = { at: Date.now(), data: (await res.json()) as NameLines };
    } catch (e) {
      this.log.warn(`name lines: ${String(e)}`);
    }
    return this.list.data;
  }

  async get(userId: string, body: LineVoicesBody, origin: string): Promise<LineVoicesView> {
    const nl = await this.lines();
    if (!nl || (!this.cfg.GEMINI_API_KEY && !this.cfg.FISH_API_KEY)) return { voices: {}, pending: 0 };
    const items: { key: string; hash: string; job: JobPayloads['voice.line'] }[] = [];
    for (const key of new Set(body.keys)) {
      const l = nl.lines[key];
      const text = l && fillNames(l.text, body.names);
      if (!l || !text) continue;
      // keyed by what is spoken: a reading fixed later (STORY_READINGS) voices the line again
      const hash = createHash('sha256').update(JSON.stringify([l.who, l.act ?? '', speakText(text), l.spec, l.brief, nl.tempo, nl.model])).digest('hex').slice(0, 32);
      items.push({ key, hash, job: { userId, hash, origin, who: l.who, act: l.act, text, spec: l.spec, brief: l.brief, model: nl.model, tempo: nl.tempo } });
    }
    if (!items.length) return { voices: {}, pending: 0 };
    const rows = await this.db.write
      .select({ hash: lineVoices.hash, url: lineVoices.url })
      .from(lineVoices)
      .where(and(eq(lineVoices.userId, userId), inArray(lineVoices.hash, [...new Set(items.map((i) => i.hash))])));
    const made = new Map(rows.map((r) => [r.hash, r.url]));
    const voices: Record<string, string> = {};
    const missing = new Map<string, JobPayloads['voice.line']>();
    for (const it of items) {
      const url = made.get(it.hash);
      if (url) voices[it.key] = url;
      else missing.set(it.hash, it.job);
    }
    // queue what is missing, once (a mark for 15 minutes; a failed line is tried again after that)
    for (const [hash, job] of missing) {
      const mark = `lv:${userId}:${hash}`;
      if (await this.kv.get(mark)) continue;
      if ((await this.kv.incr(`lv-day:${userId}:${Math.floor(Date.now() / 86_400_000)}`, 86_400)) > DAILY) break;
      await this.kv.set(mark, '1', 900);
      await this.queue.enqueue('voice.line', job, { dedupeKey: `lv-${userId.slice(0, 8)}-${hash}` }).catch((e) => this.log.warn(`queue: ${String(e)}`));
    }
    return { voices, pending: missing.size };
  }

  /**
   * One of {bati}'s answers read aloud now, in the story's {bati} voice (story chat M-R179: the Moon chat answers
   * in words and in {bati}'s voice). The faster TTS model (one sentence in about two seconds); the caller plays it
   * when it comes and goes on with the words alone if it does not. The answer was already checked by the buddy.
   */
  async batiSays(userId: string, text: string, origin: string): Promise<{ url: string } | null> {
    const nl = await this.lines();
    const bati = nl && Object.values(nl.lines).find((l) => l.who === 'バティ');
    if (!nl || !bati || !this.cfg.GEMINI_API_KEY) return null;
    if ((await this.kv.incr(`lv-day:${userId}:${Math.floor(Date.now() / 86_400_000)}`, 86_400)) > DAILY) return null;
    const p: JobPayloads['voice.line'] = { userId, hash: '', origin, who: 'バティ', text, spec: { ...bati.spec, model: undefined }, brief: bati.brief, model: BATI_SAYS_MODEL, tempo: nl.tempo };
    const mp3 = await this.slot(() => this.gemini(p, storyVoiceFilter(p.spec, p.tempo)));
    const m = await this.media.storeAudio(userId, 'audio/mpeg', mp3, origin);
    return { url: m.url };
  }

  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= AT_ONCE) await new Promise<void>((r) => this.waiting.push(r));
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }

  /** the job: voice one line, keep it, remember it */
  async make(p: JobPayloads['voice.line']): Promise<void> {
    const [had] = await this.db.write
      .select({ hash: lineVoices.hash })
      .from(lineVoices)
      .where(and(eq(lineVoices.userId, p.userId), eq(lineVoices.hash, p.hash)));
    if (had) return;
    const mp3 = await this.slot(() => this.voice(p));
    const m = await this.media.storeAudio(p.userId, 'audio/mpeg', mp3, p.origin);
    await this.db.write.insert(lineVoices).values({ userId: p.userId, hash: p.hash, url: m.url }).onConflictDoNothing();
    this.log.log(`${p.who} line voiced for ${p.userId}`);
  }

  /** the line in its character's voice; a take far too short for its words was cut off: try again (keep the longest) */
  private async voice(p: JobPayloads['voice.line']): Promise<Buffer> {
    const filter = storyVoiceFilter(p.spec, p.tempo);
    const chars = p.text.replace(/[\s、。，．！？!?…・「」『』（）()〜ー＊*“”"-]/g, '').length;
    let best: { mp3: Buffer; sec: number } | null = null;
    for (let take = 0; take < 3; take++) {
      const mp3 = p.spec.model ? await this.fish(p, filter) : await this.gemini(p, filter);
      const sec = seconds(mp3);
      if (!best || sec > best.sec) best = { mp3, sec };
      if (chars < 6 || chars / best.sec <= 13) break;
    }
    return best!.mp3;
  }

  private async fish(p: JobPayloads['voice.line'], filter: string): Promise<Buffer> {
    if (!this.cfg.FISH_API_KEY) throw new Error('FISH_API_KEY is not set');
    const raw = await textToSpeech(this.cfg.FISH_API_KEY, this.cfg.FISH_MODEL, { text: speakText(p.text), referenceId: p.spec.model! });
    return finish(raw, [], filter);
  }

  private async gemini(p: JobPayloads['voice.line'], filter: string): Promise<Buffer> {
    const key = this.cfg.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set');
    const prompt = storyVoicePrompt(p.spec.brief ?? p.brief, p.act, p.text);
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${GEMINI}/models/${p.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.spec.voice } } } } }),
        signal: AbortSignal.timeout(120_000),
      });
      const j = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]; error?: { message: string } };
      const part = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data);
      if (!part) {
        // busy, or a short line it would not voice this time (finishReason OTHER): try again
        const other = JSON.stringify(j).includes('"OTHER"');
        if (res.status === 429 || res.status >= 500 || other) {
          await new Promise((r) => setTimeout(r, (other ? 1500 : 5000) * (attempt + 1)));
          continue;
        }
        throw new Error(`gemini tts ${res.status} ${j.error?.message ?? ''}`.trim());
      }
      const rate = part.inlineData!.mimeType?.match(/rate=(\d+)/)?.[1] ?? '24000';
      return finish(Buffer.from(part.inlineData!.data!, 'base64'), ['-f', 's16le', '-ar', rate, '-ac', '1'], filter);
    }
    throw new Error('the voice service kept failing');
  }
}
