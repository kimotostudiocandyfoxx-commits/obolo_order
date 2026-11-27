'use client';

import { BATI_VOICE_EXPLAIN, BATI_VOICE_TARGET_SECONDS } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MicGlyph } from '@/components/dachi/HoldMic';
import { getApi } from '@/lib/api';
import { afterTake, blobBase64, ringDash } from '@/lib/onboarding/eggVoice';
import { useRecorder } from '@/lib/useRecorder';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const R = 60;
const C = 2 * Math.PI * R;

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

/**
 * the words while held (the browser's own recogniser, nothing sent). While recording, not on iPhone / iPad: it fights the
 * recording there (listening only — M-R250 — it is used everywhere)
 */
function wordsRecognizer(recording: boolean): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && recording) return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * D03-S005 「{bati}に声を聞かせる」 (M-R246 / M-R247; M-R334, client 2026-11-27: after {bati} is born and named, and a TAP
 * starts it and a TAP ends it — no holding): a big mic in the middle; a light ring around it fills with the length
 * spoken (full at BATI_VOICE_TARGET_SECONDS, where it stops by itself). Stopped too soon → OBOLON's
 * `short` line and the next tap goes on where it stopped (the takes are appended). Full → the takes go to the server
 * in the background (POST /voice/bati: {bati}'s voice, only with the start-of-app agreement) and the story goes on with
 * the words heard (shown as {name}'s bubble). The example sentence small under the mic. No explanation on the screen:
 * a small ⓘ beside the mic shows how the voice is used to those who tap it (M-R247).
 * `fake` (the demo, the review page, screenshots): no microphone and nothing sent — the ring fills by time.
 * `listenOnly` (M-R250: under 13, or 13〜15 without the guardian's consent): the same scene, the words heard shown, but no
 * audio is recorded or sent and no voice model is made ({bati} gets a prepared voice).
 */
export function EggVoiceStep({
  example,
  fake = false,
  listenOnly = false,
  onShort,
  onDone,
}: {
  example: string;
  fake?: boolean;
  listenOnly?: boolean;
  /** the first time it was too short: OBOLON 「、、、もう少し、聞かせてやれ。」 goes into the thread */
  onShort?: () => void;
  onDone: (r: { words: string; seconds: number; skipped?: boolean }) => void;
}) {
  const rec = useRecorder(BATI_VOICE_TARGET_SECONDS + 2, 'egg', { keepSilent: true });
  // audio is recorded only when it may become {bati}'s voice
  const recording = !fake && !listenOnly;
  const takes = useRef<{ blob: Blob | null; seconds: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [live, setLive] = useState(0);
  const [held, setHeld] = useState(false);
  const [asked, setAsked] = useState(false);
  const [info, setInfo] = useState(false);
  const [done, setDone] = useState(false);
  const words = useRef('');
  const heard = useRef<Rec | null>(null);
  const pressAt = useRef(0);
  const holding = useRef(false);
  const doneRef = useRef(false);
  const totalRef = useRef(0);

  const finish = useCallback(
    (sec: number) => {
      if (doneRef.current) return;
      doneRef.current = true;
      setDone(true);
      const said = words.current.trim();
      if (recording) {
        // in the background: the story never waits for the voice (a failure leaves {bati} with the default voice)
        const list = takes.current.filter((t) => t.blob);
        void (async () => {
          try {
            const enc = await Promise.all(list.map(async (t) => ({ mime: t.blob!.type || 'audio/webm', data: await blobBase64(t.blob!) })));
            if (enc.length) await getApi().batiVoice({ takes: enc, seconds: Math.round(sec * 10) / 10, ...(said ? { text: said.slice(0, 300) } : {}) });
          } catch {
            /* {bati} speaks in the default voice; the settings show it */
          }
        })();
      }
      setTimeout(() => onDone({ words: said, seconds: sec }), 900);
    },
    [recording, onDone],
  );

  const addTake = useCallback(
    (blob: Blob | null, seconds: number) => {
      if (seconds < 0.3) return;
      takes.current.push({ blob, seconds });
      const t = totalRef.current + seconds;
      totalRef.current = t;
      setTotal(t);
      setLive(0);
      if (afterTake(t) === 'full') return finish(t);
      if (!asked) onShort?.();
      setAsked(true);
    },
    [asked, finish, onShort],
  );

  // the microphone may take a moment to open: a finger already lifted stops it as soon as it has started
  useEffect(() => {
    if (rec.recording && !holding.current) rec.stop();
  }, [rec.recording, rec.stop]);

  // a real take ends: its recording comes in
  useEffect(() => {
    if (!rec.blob) return;
    addTake(rec.blob, rec.duration);
    rec.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.blob]);

  // the ring follows the finger; full while still held → it stops by itself
  useEffect(() => {
    if (!held) return;
    let raf = 0;
    const tick = () => {
      const s = (Date.now() - pressAt.current) / 1000;
      setLive(s);
      if (totalRef.current + s >= BATI_VOICE_TARGET_SECONDS) return release();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  const press = () => {
    if (doneRef.current || holding.current) return;
    holding.current = true;
    pressAt.current = Date.now();
    setHeld(true);
    if (fake) return;
    if (recording) void rec.start();
    const W = wordsRecognizer(recording);
    if (W) {
      try {
        const r = new W();
        r.lang = 'ja-JP';
        r.interimResults = false;
        r.continuous = true;
        r.onresult = (e) => {
          for (let k = e.resultIndex; k < e.results.length; k++) if (e.results[k].isFinal) words.current += e.results[k][0].transcript;
        };
        r.onerror = () => undefined;
        r.start();
        heard.current = r;
      } catch {
        /* no words: the bubble stays out */
      }
    }
  };

  function release() {
    if (!holding.current) return;
    holding.current = false;
    setHeld(false);
    heard.current?.stop();
    heard.current = null;
    if (!recording) return addTake(null, (Date.now() - pressAt.current) / 1000);
    rec.stop();
  }

  // the page losing focus ends the take too
  useEffect(() => {
    if (!held) return;
    const up = () => release();
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('blur', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  const shown = Math.min(BATI_VOICE_TARGET_SECONDS, total + (held ? live : 0));
  // client 2026-11-27: the line says what is wrong on this phone and browser (lib/mic/core micAdvice)
  const trouble = recording && rec.advice ? rec.advice.text : null;

  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-6 pt-16 text-amber-50" style={{ fontFamily: SERIF }}>
      <div className="mx-auto flex max-w-sm flex-col items-center pb-6">
        <div className="relative">
          <span aria-hidden className={`mystic-motes absolute -inset-10 rounded-full transition-opacity duration-700 ${held ? 'opacity-100' : 'opacity-40'}`} />
          <svg viewBox="0 0 140 140" className="h-[148px] w-[148px] -rotate-90" aria-hidden>
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,226,160,0.16)" strokeWidth="5" />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="url(#eggRing)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={ringDash(shown, C)}
              strokeOpacity={shown > 0.05 ? 1 : 0}
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,214,140,0.85))', transition: held ? undefined : 'stroke-dasharray .3s ease-out' }}
            />
            <defs>
              <linearGradient id="eggRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff4cf" />
                <stop offset="1" stopColor="#e8b45a" />
              </linearGradient>
            </defs>
          </svg>
          <button
            type="button"
            aria-label={held ? 'タップで、話しおわる' : 'タップで、話しはじめる'}
            aria-pressed={held}
            data-testid="egg-voice-mic"
            disabled={done || !!trouble}
            onClick={() => (holding.current ? release() : press())}
            onContextMenu={(e) => e.preventDefault()}
            className={`absolute left-1/2 top-1/2 grid h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 touch-none select-none place-items-center rounded-full border transition disabled:opacity-50 ${held ? 'scale-105 border-amber-100 shadow-[0_0_40px_rgba(255,204,120,0.75)]' : 'border-amber-200/70 shadow-[0_0_22px_rgba(255,204,120,0.3)]'}`}
            style={{ background: held ? 'radial-gradient(circle at 50% 35%,rgba(255,214,140,0.4),rgba(40,26,8,0.92) 70%)' : 'radial-gradient(circle at 50% 30%,rgba(70,48,18,0.95),rgba(8,6,12,0.95) 72%)' }}
          >
            <MicGlyph className={`h-10 w-10 ${held ? 'text-amber-50' : 'text-amber-200'}`} />
          </button>
          {/* M-R247: no explanation on the screen — a small, quiet ⓘ for those who want to know (nothing kept: none) */}
          {!listenOnly && <button type="button" onClick={() => setInfo((x) => !x)} aria-label="声の使い道" className="absolute -right-7 bottom-3 grid h-6 w-6 place-items-center rounded-full border border-white/20 text-[11px] text-white/40">
            i
          </button>}
        </div>
        {info && <p className="mt-2 rounded-xl bg-black/70 px-3 py-2 text-[11px] leading-relaxed text-white/70">{BATI_VOICE_EXPLAIN}</p>}
        {/* M-R247 / M-R334: no explanation on the screen (the world stays whole) — only what is wrong with the mic, if anything */}
        <p className="mt-1 min-h-[18px] text-center text-[12px] leading-relaxed text-amber-100/80">{trouble ?? ''}</p>
        <p className="mt-1 text-center text-[11px] leading-relaxed text-white/50">例「{example}」</p>
        {trouble && (
          <button type="button" onClick={() => onDone({ words: '', seconds: 0, skipped: true })} className="mt-3 text-[12px] text-white/55 underline">
            このまま進む
          </button>
        )}
      </div>
    </div>
  );
}
