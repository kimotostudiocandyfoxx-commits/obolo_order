'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Voice input, the main way to type in this app (client decision 2026-10-07: mic first).
 * Tap once → start listening, tap again → stop. What is heard is inserted where the cursor is
 * (replacing a selection), so fixing a part is: tap there / select it, delete, speak again.
 * Uses the browser's speech recognition (Safari on iPad: webkitSpeechRecognition).
 */
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type Field = HTMLTextAreaElement | HTMLInputElement;

function recognizer(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation({ field, value, onChange, maxLength, lang = 'ja-JP' }: { field: RefObject<Field | null>; value: string; onChange: (v: string) => void; maxLength?: number; lang?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<'denied' | 'failed' | null>(null);
  const rec = useRef<Rec | null>(null);
  const want = useRef(false);
  // the text around the insertion point while listening, and what has been heard so far
  const session = useRef({ before: '', after: '', heard: '' });
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => setSupported(!!recognizer()), []);
  useEffect(() => () => rec.current?.abort(), []);

  const write = useCallback(() => {
    const s = session.current;
    let next = s.before + s.heard + s.after;
    if (maxLength) next = next.slice(0, maxLength);
    latest.current.onChange(next);
  }, [maxLength]);

  const listen = useCallback(() => {
    const R = recognizer();
    if (!R) return;
    const r = new R();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else mid += t;
      }
      if (fin) {
        session.current.heard += fin;
        write();
      }
      setInterim(mid);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        want.current = false;
        setError('denied');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('failed');
    };
    // Safari stops after a pause: keep listening until the member taps again
    r.onend = () => {
      setInterim('');
      if (want.current) {
        try {
          r.start();
          return;
        } catch {
          /* fall through to stopped */
        }
      }
      setListening(false);
      const el = field.current;
      const s = session.current;
      if (el) {
        const at = s.before.length + s.heard.length;
        el.focus();
        el.setSelectionRange(at, at);
      }
    };
    rec.current = r;
    r.start();
  }, [field, lang, write]);

  const start = useCallback(() => {
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
    want.current = true;
    setListening(true);
    try {
      listen();
    } catch {
      want.current = false;
      setListening(false);
      setError('failed');
    }
  }, [field, lang, listen]);

  const stop = useCallback(() => {
    want.current = false;
    rec.current?.stop();
  }, []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, interim, error, toggle, stop };
}
