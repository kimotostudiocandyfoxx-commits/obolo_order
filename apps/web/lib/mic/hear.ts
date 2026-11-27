'use client';

import { getApi } from '@/lib/api';
import { micSession } from '@/lib/onboarding/audio';
import { closeMic, openMic, quietMic } from '@/lib/micStream';
import {
  AUTO_STOP,
  SILENT_PEAK,
  afterEmptyTake,
  autoStop,
  blobType,
  faultOfApi,
  faultOfError,
  pickMime,
  restartPlan,
  speechErrorAction,
  voiceGate,
  type HearEngine,
  type MicFault,
  type MicPath,
} from './core';
import { canRecord, currentEngine, currentEnv, markSpeechFailed, recognizerClass, reportMic, type Recognizer } from './env';
import { micMeter, type MicMeter } from './meter';

/**
 * One take of the mic, heard as words — the one way in for every "speak instead of typing" in the app (the talk with
 * {bati}, the atelier, the story's answers, Saturn's stones …). Client 2026-11-27 (phones: 「マイクが反応しない」).
 *
 * Two engines, chosen by lib/mic/core pickEngine:
 * - 'speech': the browser's own recogniser (Safari on iPhone / iPad, Chrome on Android and the desktop). It is started
 *   again after every pause until the member stops (iOS ends it by itself), the page's kept mic stream is closed first
 *   (two captures at once silence each other on iPhone), and any real error goes on with the recorder below instead of
 *   ending in a notice.
 * - 'record': MediaRecorder (audio/mp4 on iPhone, webm elsewhere) → POST /voice/dictate → the words. For the browsers
 *   whose recogniser is missing or refuses: Chrome / Firefox / Edge on iPhone, every in-app browser, Firefox. It shows
 *   the real loudness while it listens and stops by itself after a quiet.
 *
 * Call hear() from the tap itself: the microphone must be asked for inside the user's action.
 */
export type HearPhase = 'opening' | 'listening' | 'hearing' | 'thinking';
export type HearEnd = { fault: MicFault | null; heard: boolean; engine: HearEngine };
export type HearOpts = {
  path: MicPath;
  lang?: string;
  onPhase?: (p: HearPhase) => void;
  /** the loudness now, 0..1 (the recorder only; the recogniser gives no level — the phase says 'hearing') */
  onLevel?: (level: number) => void;
  /** words not final yet */
  onInterim?: (text: string) => void;
  /** words to add */
  onFinal: (text: string) => void;
  onEnd: (r: HearEnd) => void;
  /** the recorder stops after a quiet (default: yes) */
  autoStop?: boolean;
  /** the recorder's longest take */
  maxMs?: number;
  /** the recording → its words (default: POST /voice/dictate) */
  transcribe?: (blob: Blob) => Promise<string>;
};
export type Hearing = {
  /** the member is done: the last words still come in */
  stop: () => void;
  /** away with it: nothing more is reported */
  abort: () => void;
  engine: () => HearEngine | null;
};

const HEARING_HOLD_MS = 700;

/** takes in a row that ended without a word (the recogniser "listens" but hears nothing → the recorder) */
let emptyTakes = 0;

export function hear(o: HearOpts): Hearing {
  let engine = currentEngine();
  let over = false;
  let heard = false;
  let stopFn: () => void = () => undefined;
  let abortFn: () => void = () => undefined;

  const end = (fault: MicFault | null, name?: string) => {
    if (over) return;
    over = true;
    if (heard) emptyTakes = 0;
    if (fault && fault !== 'empty') reportMic({ path: o.path, fault, engine: engine ?? 'stream', name });
    o.onEnd({ fault: heard ? null : fault, heard, engine: engine ?? 'record' });
  };
  const final = (t: string) => {
    const s = t.trim();
    if (!s) return;
    heard = true;
    o.onFinal(t);
  };

  /* ── the recorder: record → /voice/dictate ── */
  const record = () => {
    engine = 'record';
    o.onPhase?.('opening');
    if (!canRecord()) return end('unsupported');
    let rec: MediaRecorder | null = null;
    let meter: MicMeter | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    let wantStop = false;
    let dropped = false;
    const startedAt = Date.now();
    const gate = voiceGate();
    let metered = 0;
    const tidy = () => {
      if (tick) clearInterval(tick);
      tick = null;
      meter?.close();
      meter = null;
    };
    stopFn = () => {
      wantStop = true;
      if (rec && rec.state !== 'inactive') rec.stop();
    };
    abortFn = () => {
      dropped = true;
      over = true;
      stopFn();
    };
    // asked for at once, inside the tap
    openMic().then(
      (stream) => {
        if (dropped || over) return quietMic();
        const mime = pickMime(typeof MediaRecorder.isTypeSupported === 'function' ? (t) => MediaRecorder.isTypeSupported(t) : undefined);
        try {
          rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        } catch (e) {
          quietMic();
          return end(faultOfError(e), (e as Error)?.name);
        }
        const r = rec;
        const chunks: Blob[] = [];
        r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
        r.onerror = () => stopFn();
        r.onstop = () => {
          tidy();
          quietMic();
          if (dropped) return;
          const ms = Date.now() - startedAt;
          const type = blobType(r.mimeType, mime, currentEnv());
          const blob = new Blob(chunks, { type });
          // nothing came in at all (a muted mic, another app has it): say so, send nothing
          if (blob.size === 0 || (metered > 5 && gate.peak < SILENT_PEAK)) {
            reportMic({ path: o.path, fault: 'silent', engine: 'record', mime: type, name: blob.size === 0 ? 'empty-blob' : 'zero-level' });
            over = true;
            return o.onEnd({ fault: 'silent', heard: false, engine: 'record' });
          }
          // too short, or only the room's hush and never a voice: nothing to turn into words (and nothing sent)
          if (ms < 350 || (metered > 5 && !gate.spoke && gate.peak < SILENT_PEAK * 4)) return end('empty');
          o.onPhase?.('thinking');
          const toWords = o.transcribe ?? (async (b: Blob) => (await getApi().dictate(b)).text);
          toWords(blob).then(
            (text) => {
              if (dropped) return;
              if (text.trim()) final(text.trim());
              end(text.trim() ? null : 'empty');
            },
            (e) => {
              if (dropped) return;
              const f = faultOfApi(e);
              reportMic({ path: o.path, fault: f, engine: 'record', mime: type, name: (e as { code?: string })?.code });
              over = true;
              o.onEnd({ fault: f, heard: false, engine: 'record' });
            },
          );
        };
        // the phone took the mic away in the middle (a call, the lock screen): the take ends with what it has
        for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => stopFn(), { once: true });
        try {
          r.start(250);
        } catch (e) {
          quietMic();
          return end(faultOfError(e), (e as Error)?.name);
        }
        o.onPhase?.('listening');
        meter = micMeter(stream);
        const max = o.maxMs ?? AUTO_STOP.maxMs;
        let was = false;
        tick = setInterval(() => {
          const now = Date.now();
          const ran = now - startedAt;
          if (meter?.live()) {
            const lv = meter.level();
            metered++;
            gate.feed(lv, now);
            // "hearing" holds a moment after the last sound, so the line does not flicker between syllables
            const on = gate.spoke && gate.quietFor(now) < HEARING_HOLD_MS;
            o.onLevel?.(lv);
            if (on !== was) o.onPhase?.(on ? 'hearing' : 'listening');
            was = on;
            if (o.autoStop !== false && autoStop({ spoke: gate.spoke, quietMs: gate.quietFor(now), ranMs: ran }, { ...AUTO_STOP, maxMs: max })) return stopFn();
          }
          if (ran >= max) stopFn();
        }, 60);
        if (wantStop) stopFn();
      },
      (e) => {
        if (dropped) return;
        end(faultOfError(e), (e as Error)?.name ?? String((e as Error)?.message ?? ''));
      },
    );
  };

  /* ── the browser's recogniser ── */
  const speech = () => {
    const R = recognizerClass();
    if (!R) return record();
    engine = 'speech';
    o.onPhase?.('opening');
    // one capture at a time: the stream kept from a recording would leave the recogniser deaf on iPhone
    closeMic();
    micSession(true);
    let want = true;
    let quickEnds = 0;
    let startedAt = Date.now();
    let hadError = false;
    let interim = '';
    let forced: ReturnType<typeof setTimeout> | null = null;
    const r: Recognizer = new R();
    r.lang = o.lang ?? 'ja-JP';
    r.interimResults = true;
    r.continuous = true;
    const done = () => {
      if (forced) clearTimeout(forced);
      r.onend = null;
      r.onerror = null;
      r.onresult = null;
      micSession(false);
      // words that never became final (iOS cuts the last ones on stop)
      if (interim.trim()) final(interim);
      interim = '';
      o.onInterim?.('');
      if (!heard) {
        emptyTakes++;
        if (afterEmptyTake(emptyTakes) === 'fallback' && canRecord()) {
          emptyTakes = 0;
          markSpeechFailed();
          reportMic({ path: o.path, fault: 'fallback', engine: 'speech', name: 'no-words' });
        }
      }
      end(heard ? null : 'empty');
    };
    const toRecorder = (code: string) => {
      hadError = true;
      want = false;
      if (forced) clearTimeout(forced);
      r.onend = null;
      r.onerror = null;
      r.onresult = null;
      try {
        r.abort();
      } catch {
        /* over already */
      }
      markSpeechFailed();
      reportMic({ path: o.path, fault: 'fallback', engine: 'speech', name: code });
      if (interim.trim()) final(interim);
      interim = '';
      o.onInterim?.('');
      // the recorder says exactly what is wrong (not allowed, no mic, busy) — or simply works
      if (canRecord()) return record();
      micSession(false);
      end(code === 'not-allowed' ? 'denied' : code === 'audio-capture' ? 'busy' : 'unsupported', code);
    };
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else mid += t;
      }
      if (fin) final(fin);
      interim = mid;
      o.onInterim?.(mid);
      o.onPhase?.('hearing');
    };
    r.onspeechstart = () => o.onPhase?.('hearing');
    r.onspeechend = () => o.onPhase?.('listening');
    r.onerror = (e) => {
      if (speechErrorAction(e.error) === 'fallback') toRecorder(e.error);
    };
    r.onend = () => {
      const plan = restartPlan({ want, quickEnds, ranMs: Date.now() - startedAt, hadError });
      quickEnds = plan.quickEnds;
      if (plan.restart) {
        try {
          startedAt = Date.now();
          r.start();
          return;
        } catch {
          /* cannot start again: over */
        }
      }
      // it ended by itself again and again without a word: this recogniser is dead here
      if (want && !heard && quickEnds > 0) return toRecorder('ends-at-once');
      done();
    };
    stopFn = () => {
      if (!want) return;
      want = false;
      try {
        r.stop();
      } catch {
        /* not started */
      }
      // iOS Safari sometimes never fires onend after a stop: end anyway after a moment (client 2026-10-29)
      forced = setTimeout(() => {
        try {
          r.abort();
        } catch {
          /* over */
        }
        done();
      }, 900);
    };
    abortFn = () => {
      want = false;
      over = true;
      if (forced) clearTimeout(forced);
      r.onend = null;
      r.onerror = null;
      r.onresult = null;
      try {
        r.abort();
      } catch {
        /* over */
      }
      micSession(false);
    };
    try {
      r.start();
      o.onPhase?.('listening');
    } catch {
      toRecorder('start-failed');
    }
  };

  if (engine === 'speech') speech();
  else if (engine === 'record') record();
  else {
    o.onPhase?.('opening');
    // told after the caller has its handle
    setTimeout(() => end('unsupported'), 0);
  }

  return { stop: () => stopFn(), abort: () => abortFn(), engine: () => engine };
}
