import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIC_DIAG_KEEP, MicDiagBody } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { VoiceService } from '../voice/voice.service';
import { countKey, readMicDiag, recordMicDiag, tokyoDay } from './mic-diag';

const report = (over: Partial<MicDiagBody> = {}): MicDiagBody => ({ path: 'bati', fault: 'denied', engine: 'record', name: 'NotAllowedError', os: 'ios', browser: 'chrome', inApp: false, standalone: false, ...over });

describe('POST /diag/mic: what the web app may tell', () => {
  it('takes the small fixed report', () => {
    expect(MicDiagBody.safeParse(report()).success).toBe(true);
    expect(MicDiagBody.safeParse(report({ fault: 'fallback', engine: 'speech', name: 'service-not-allowed' })).success).toBe(true);
    expect(MicDiagBody.safeParse(report({ mime: 'audio/mp4' })).success).toBe(true);
  });
  it('no free text, no long values, no unknown places (nothing personal can ride along)', () => {
    expect(MicDiagBody.safeParse(report({ name: 'わたしの名前' })).success).toBe(false);
    expect(MicDiagBody.safeParse(report({ name: 'a b' })).success).toBe(false);
    expect(MicDiagBody.safeParse(report({ fault: 'x'.repeat(25) })).success).toBe(false);
    expect(MicDiagBody.safeParse({ ...report(), path: 'somewhere' }).success).toBe(false);
    expect(MicDiagBody.safeParse({ ...report(), browser: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)' }).success).toBe(false);
    // extra keys (a user agent, an id) are dropped, not kept
    const parsed = MicDiagBody.parse({ ...report(), userAgent: 'Mozilla/5.0', userId: 'u1' });
    expect(Object.keys(parsed).sort()).toEqual(['browser', 'engine', 'fault', 'inApp', 'name', 'os', 'path', 'standalone']);
  });
});

describe('the operator’s view', () => {
  it('the newest first, with a count per day and "os/browser fault"', async () => {
    const kv = new MemoryKv();
    const t0 = new Date('2026-11-27T03:00:00Z');
    await recordMicDiag(kv, report(), t0);
    await recordMicDiag(kv, report(), new Date(t0.getTime() + 1000));
    await recordMicDiag(kv, report({ fault: 'fallback', engine: 'speech', name: 'service-not-allowed', browser: 'safari' }), new Date(t0.getTime() + 2000));
    await recordMicDiag(kv, report({ os: 'android', browser: 'line', inApp: true, fault: 'unsupported' }), new Date(t0.getTime() + 3000));
    const v = await readMicDiag(kv, new Date(t0.getTime() + 4000));
    expect(v.recent).toHaveLength(4);
    expect(v.recent[0]).toMatchObject({ os: 'android', browser: 'line', at: '2026-11-27T03:00:03.000Z' });
    expect(v.days).toEqual([{ day: '2026-11-27', counts: { 'ios/chrome denied': 2, 'ios/safari fallback': 1, 'android/line(in-app) unsupported': 1 } }]);
  });
  it('keeps only the last reports', async () => {
    const kv = new MemoryKv();
    for (let k = 0; k < MIC_DIAG_KEEP + 5; k++) await recordMicDiag(kv, report({ fault: `f${k}` }), new Date(1_800_000_000_000 + k));
    const v = await readMicDiag(kv, new Date(1_800_000_000_000));
    expect(v.recent).toHaveLength(MIC_DIAG_KEEP);
    expect(v.recent[0].fault).toBe(`f${MIC_DIAG_KEEP + 4}`);
  });
  it('the day is Japan’s', () => {
    expect(tokyoDay(new Date('2026-11-27T14:59:00Z'))).toBe('2026-11-27');
    expect(tokyoDay(new Date('2026-11-27T15:00:00Z'))).toBe('2026-11-28');
    expect(countKey(report())).toBe('ios/chrome denied');
  });
});

/** POST /voice/dictate: the take of a phone whose browser cannot hear by itself → words, nothing stored */
describe('POST /voice/dictate', () => {
  const heard: { bytes: number; mime: string }[] = [];
  const service = (llm: { transcribe?: (b: Buffer, m: string) => Promise<string> }) =>
    new VoiceService({} as never, {} as never, {} as never, llm as never);
  const say = async (b: Buffer, m: string) => {
    heard.push({ bytes: b.length, mime: m });
    return '  こんにちは、 バティ  ';
  };
  const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
  /** one second of a tone, the way each browser records it */
  const take = (args: string[], file: string): Buffer => {
    const dir = mkdtempSync(join(tmpdir(), 'dictate-'));
    try {
      const out = join(dir, file);
      const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', ...args, out]);
      if (r.status !== 0) throw new Error(String(r.stderr));
      return readFileSync(out);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it.skipIf(!hasFfmpeg)('iPhone (Safari, Chrome, in-app): a fragmented audio/mp4 take becomes words', async () => {
    // MediaRecorder on WebKit with a timeslice: fragmented MP4 (AAC), also sent as 「audio/mp4;codecs=mp4a.40.2」
    const mp4 = take(['-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4'], 'take.mp4');
    heard.length = 0;
    const r = await service({ transcribe: say }).dictate('audio/mp4;codecs=mp4a.40.2', mp4);
    expect(r).toEqual({ text: 'こんにちは、 バティ' });
    expect(heard[0].mime).toBe('audio/mp3');
    expect(heard[0].bytes).toBeGreaterThan(1000);
  });

  it.skipIf(!hasFfmpeg)('Chrome on Android / Firefox: audio/webm (opus) becomes words', async () => {
    const webm = take(['-c:a', 'libopus', '-f', 'webm'], 'take.webm');
    const r = await service({ transcribe: say }).dictate('audio/webm;codecs=opus', webm);
    expect(r.text).toBe('こんにちは、 バティ');
  });

  it('refuses what is not a recording, an empty body, and says when the words cannot be made', async () => {
    const s = service({ transcribe: say });
    await expect(s.dictate('text/plain', Buffer.from('x'))).rejects.toMatchObject({ response: { error: { code: 'UNSUPPORTED_AUDIO' } } });
    await expect(s.dictate('audio/mp4', Buffer.alloc(0))).rejects.toMatchObject({ response: { error: { code: 'EMPTY_UPLOAD' } } });
    await expect(s.dictate('audio/mp4', 'not a buffer')).rejects.toMatchObject({ response: { error: { code: 'EMPTY_UPLOAD' } } });
    await expect(service({}).dictate('audio/mp4', Buffer.from('abc'))).rejects.toMatchObject({ response: { error: { code: 'STT_OFF' } } });
  });

  it.skipIf(!hasFfmpeg)('bytes that are no audio: BAD_AUDIO (the model is not asked)', async () => {
    heard.length = 0;
    await expect(service({ transcribe: say }).dictate('audio/mp4', Buffer.from('this is not an mp4 file at all'))).rejects.toMatchObject({ response: { error: { code: 'BAD_AUDIO' } } });
    expect(heard).toHaveLength(0);
  });
});
