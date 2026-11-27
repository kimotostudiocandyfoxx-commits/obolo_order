'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { micAdvice, type HearEngine, type MicAdvice, type MicFault, type MicPath } from '@/lib/mic/core';
import { currentEngine, currentEnv } from '@/lib/mic/env';
import { hear, type HearPhase, type Hearing } from '@/lib/mic/hear';

/**
 * Voice input, the main way to type in this app (client decision 2026-10-07: mic first).
 * Tap once → start listening, tap again → stop. What is heard is inserted where the cursor is
 * (replacing a selection), so fixing a part is: tap there / select it, delete, speak again.
 *
 * Client 2026-11-27 (phones: 「マイクが反応しないことが多い」): the hearing itself is lib/mic/hear.ts now — the browser's
 * speech recognition where it works (Safari on iPhone / iPad, Chrome on Android), else the recorder and the server's
 * words (iPhone Chrome / Firefox / Edge, in-app browsers, Firefox: there the mic used to be dead, or to open the
 * keyboard without a word). `supported` is true wherever either way exists; `phase` and `level` say that it listens;
 * `advice` is the one line of what to do when it could not.
 */
type Field = HTMLTextAreaElement | HTMLInputElement;

const FAULTS: MicFault[] = ['denied', 'no-device', 'busy', 'unsupported', 'silent', 'empty', 'stt', 'network', 'failed'];

/**
 * Why the voice cannot be heard, in one line (story chat 2026-10-29: never switch to the keyboard by itself; say why
 * and leave the small ⌨ in the corner). The code is a mic fault (lib/mic/core MicFault) or, from older callers, the
 * recogniser's own error code. PROVISIONAL wording: lib/mic/core micAdvice.
 */
export function micTrouble(code: string | null): string | null {
  if (!code || code === 'no-speech' || code === 'aborted') return null;
  const fault: MicFault = (FAULTS as string[]).includes(code)
    ? (code as MicFault)
    : code === 'not-allowed'
      ? 'denied'
      : code === 'service-not-allowed'
        ? 'unsupported'
        : code === 'audio-capture'
          ? 'busy'
          : code === 'network'
            ? 'network'
            : 'failed';
  return micAdvice(fault, currentEnv()).text;
}

export function useDictation({
  field,
  value,
  onChange,
  maxLength,
  lang = 'ja-JP',
  path = 'other',
}: {
  field: RefObject<Field | null>;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  lang?: string;
  /** where this mic is (for the diagnostics) */
  path?: MicPath;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState<HearPhase | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [engine, setEngine] = useState<HearEngine | null>(null);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<'denied' | 'failed' | null>(null);
  // the fault of the last take (lib/mic/core MicFault), for the one-line reason (micTrouble / advice)
  const [code, setCode] = useState<MicFault | null>(null);
  const take = useRef<Hearing | null>(null);
  // the text around the insertion point while listening, and what has been heard so far
  const session = useRef({ before: '', after: '', heard: '' });
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    const e = currentEngine();
    setSupported(!!e);
    setEngine(e);
  }, []);
  useEffect(() => () => take.current?.abort(), []);

  const write = useCallback(() => {
    const s = session.current;
    let next = s.before + s.heard + s.after;
    if (maxLength) next = next.slice(0, maxLength);
    latest.current.onChange(next);
  }, [maxLength]);

  const start = useCallback(() => {
    if (take.current) return;
    const el = field.current;
    const v = latest.current.value;
    // insert at the cursor; a selection is replaced by what is said
    const a = el && document.activeElement === el ? (el.selectionStart ?? v.length) : v.length;
    const b = el && document.activeElement === el ? (el.selectionEnd ?? a) : v.length;
    const before = v.slice(0, a);
    // a space-free language: no separator; otherwise add a space between words
    const sep = lang.startsWith('ja') || !before || /\s$/.test(before) ? '' : ' ';
    session.current = { before: before + sep, after: v.slice(b), heard: '' };
    setError(null);
    setCode(null);
    setLevel(null);
    setListening(true);
    setPhase('opening');
    let ended = false;
    let live: Hearing | null = null;
    const h: Hearing = hear({
      path,
      lang,
      onPhase: (p) => {
        setPhase(p);
        // the recogniser gave up in the middle: the recorder goes on
        if (live) setEngine(live.engine());
      },
      onLevel: setLevel,
      onInterim: setInterim,
      onFinal: (t) => {
        session.current.heard += t;
        write();
      },
      onEnd: (r) => {
        ended = true;
        take.current = null;
        setInterim('');
        setListening(false);
        setPhase(null);
        setLevel(null);
        setEngine(currentEngine());
        if (r.fault) {
          setCode(r.fault);
          setError(r.fault === 'denied' ? 'denied' : 'failed');
        }
        const f = field.current;
        const s = session.current;
        if (f && r.heard) {
          const at = Math.min(s.before.length + s.heard.length, f.value.length);
          try {
            f.focus();
            f.setSelectionRange(at, at);
          } catch {
            /* a field that takes no selection */
          }
        }
      },
    });
    if (ended) return;
    live = h;
    take.current = h;
    setEngine(h.engine());
  }, [field, lang, path, write]);

  const stop = useCallback(() => take.current?.stop(), []);

  const toggle = useCallback(() => (take.current ? stop() : start()), [start, stop]);

  /** the one line of what to do (null: nothing is wrong) */
  const advice: MicAdvice | null = code ? micAdvice(code, currentEnv()) : null;

  return { supported, listening, interim, error, code, advice, phase, level, engine, toggle, stop };
}
