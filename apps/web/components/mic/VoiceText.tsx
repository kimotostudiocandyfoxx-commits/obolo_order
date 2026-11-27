'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { boxAt, caretAt, chars, deleteBack, deleteRange, EDIT_WORDS, editHintOnce, sane, stretch, type CharBox, type Sel } from '@/lib/mic/edit';

/**
 * Client 2026-11-27: the words that were heard, fixed in place — the ONE component of every voice input (the talk with
 * {bati}, the atelier, the ダチ talk and its voice message's caption, the story's voice answers).
 *
 *  - a tap on the sentence puts a caret (a thin line) there;
 *  - 〔けす〕 takes one character away per press;
 *  - a long press selects the character under the finger, dragging grows the stretch; 〔まとめてけす〕 takes it away;
 *  - the mic then puts the new words AT the caret / in place of the stretch (lib/useDictation.ts reads `edit.get()`).
 *
 * It is drawn text, not a text field: nothing is focused, so the phone's keyboard never comes up (typing stays the
 * ⌨ button's choice), and the browser's own selection, its loupe and its copy menu are off (they fight a long press
 * on iPhone). Touch is read from touch events — a touchmove listener that is not passive holds the page still while a
 * stretch is dragged, and lets it scroll otherwise; a mouse drags a stretch as on a desktop. The rules: lib/mic/edit.ts.
 */

/** how long a finger rests before it is a long press, and how far it may wander meanwhile (px) */
const HOLD_MS = 420;
const SLOP = 10;

export type VoiceEdit = {
  /** the caret / stretch (null: nothing tapped — new words go to the end) */
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  /** the selection now, for the mic (not a render's copy) */
  get: () => Sel | null;
  /** 〔けす〕 / 〔まとめてけす〕 */
  del: () => void;
};

/** the caret of one heard text; hand it to <VoiceText edit> and to useDictation({ caret }) */
export function useVoiceEdit(value: string, onChange: (v: string) => void): VoiceEdit {
  const [raw, setRaw] = useState<Sel | null>(null);
  // a caret left from a longer text (the words were sent, cleared, typed over) is brought into this one
  const sel = useMemo(() => (value ? sane(value, raw) : null), [value, raw]);
  // the words are gone (sent, cleared): the caret goes with them — the next words start a sentence of their own
  useEffect(() => {
    if (!value) setRaw(null);
  }, [value]);
  const now = useRef({ sel, value, onChange });
  now.current = { sel, value, onChange };
  const setSel = useCallback((s: Sel | null) => {
    now.current.sel = s;
    setRaw(s);
  }, []);
  const get = useCallback(() => now.current.sel, []);
  const del = useCallback(() => {
    const { sel: s, value: v } = now.current;
    if (!s) return;
    const e = s.a === s.b ? deleteBack(v, s) : deleteRange(v, s);
    now.current.sel = e.sel;
    setRaw(e.sel);
    if (e.text !== v) now.current.onChange(e.text);
  }, []);
  return useMemo(() => ({ sel, setSel, get, del }), [sel, setSel, get, del]);
}

/** ⌫ as a drawing (the character itself looks different on every phone) */
export function EraseGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" />
      <path d="m12 9.5 5 5m0-5-5 5" />
    </svg>
  );
}

export function VoiceText({
  value,
  edit,
  interim = '',
  locked = false,
  hint = true,
  className = '',
  toolClass = '',
  tone = 'dark',
  onTouch,
  testId = 'voice-text',
}: {
  value: string;
  edit: VoiceEdit;
  /** words not final yet: shown, dimmer, where they will go in */
  interim?: string;
  /** while the mic listens: the caret shows where the words go, but nothing can be moved or taken away */
  locked?: boolean;
  /** the first-time line under the sentence (off where another line already says what to do) */
  hint?: boolean;
  /** the sentence's own look (the caller's <p> classes) */
  className?: string;
  /** the row of 〔けす〕 under it */
  toolClass?: string;
  /** on a dark place (the talk, the story) or a light panel (the planet lessons) */
  tone?: 'dark' | 'light';
  /** the sentence was touched (the story's voice answer stops going on by itself) */
  onTouch?: () => void;
  /** the sentence's test id (a place whose look hangs on its own id) */
  testId?: string;
}) {
  const root = useRef<HTMLParagraphElement>(null);
  const list = useMemo(() => chars(value), [value]);
  const sel = edit.sel;
  const live = useRef({ edit, value, locked, onTouch });
  live.current = { edit, value, locked, onTouch };

  // the first time heard words are on the screen (on this device): one line says they can be fixed
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (hint && value && !showHint && editHintOnce()) setShowHint(true);
  }, [hint, value, showHint]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const boxes = (): CharBox[] =>
      Array.from(el.querySelectorAll<HTMLElement>('[data-o]')).map((c) => {
        const r = c.getBoundingClientRect();
        return { o: Number(c.dataset.o), e: Number(c.dataset.e), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
    const tap = (x: number, y: number) => {
      const at = caretAt(boxes(), x, y, live.current.value.length);
      live.current.edit.setSel({ a: at, b: at });
      live.current.onTouch?.();
    };
    let anchor: CharBox | null = null;
    const grow = (x: number, y: number) => {
      const b = boxAt(boxes(), x, y);
      if (b && anchor) live.current.edit.setSel(stretch(anchor, b));
    };
    const begin = (x: number, y: number) => {
      anchor = boxAt(boxes(), x, y);
      if (!anchor) return false;
      live.current.edit.setSel(stretch(anchor, anchor));
      live.current.onTouch?.();
      return true;
    };

    // ── a finger ──
    let press: { x: number; y: number; timer: ReturnType<typeof setTimeout> | null; selecting: boolean; moved: boolean } | null = null;
    const end = () => {
      if (press?.timer) clearTimeout(press.timer);
      press = null;
      anchor = null;
    };
    const start = (e: TouchEvent) => {
      end();
      if (live.current.locked || e.touches.length !== 1) return;
      const t = e.touches[0];
      const p = { x: t.clientX, y: t.clientY, timer: null as ReturnType<typeof setTimeout> | null, selecting: false, moved: false };
      p.timer = setTimeout(() => {
        p.timer = null;
        if (press !== p || p.moved) return;
        p.selecting = begin(p.x, p.y);
        // a small tick where the phone can (Android): the stretch has begun
        if (p.selecting) navigator.vibrate?.(8);
      }, HOLD_MS);
      press = p;
    };
    const move = (e: TouchEvent) => {
      const p = press;
      if (!p) return;
      const t = e.touches[0];
      if (p.selecting) {
        // the stretch is being dragged: the page stays still
        if (e.cancelable) e.preventDefault();
        return grow(t.clientX, t.clientY);
      }
      if (Math.hypot(t.clientX - p.x, t.clientY - p.y) > SLOP) {
        // the finger is scrolling the page: neither a tap nor a long press
        p.moved = true;
        if (p.timer) clearTimeout(p.timer);
        p.timer = null;
      }
    };
    const up = (e: TouchEvent) => {
      const p = press;
      end();
      if (!p) return;
      // no ghost click after it (the buttons under the sentence must not be pressed by the same finger)
      if (e.cancelable) e.preventDefault();
      if (!p.selecting && !p.moved) tap(p.x, p.y);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', end, { passive: true });

    // ── a mouse / a pen: a click is the caret, a drag is the stretch ──
    let drag: { x: number; y: number; on: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0 || live.current.locked) return;
      drag = { x: e.clientX, y: e.clientY, on: false };
      el.setPointerCapture?.(e.pointerId);
    };
    const over = (e: PointerEvent) => {
      if (!drag || e.pointerType === 'touch') return;
      if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.on = begin(drag.x, drag.y);
      if (drag.on) grow(e.clientX, e.clientY);
    };
    const lift = (e: PointerEvent) => {
      if (!drag || e.pointerType === 'touch') return;
      const d = drag;
      drag = null;
      anchor = null;
      if (!d.on) tap(d.x, d.y);
    };
    const none = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', over);
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    // the long press's own menu (Android), a drag of the text
    el.addEventListener('contextmenu', none);
    el.addEventListener('dragstart', none);
    return () => {
      end();
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', over);
      el.removeEventListener('pointerup', lift);
      el.removeEventListener('pointercancel', lift);
      el.removeEventListener('contextmenu', none);
      el.removeEventListener('dragstart', none);
    };
  }, []);

  const range = !!sel && sel.a !== sel.b;
  const light = tone === 'light';
  // the words not final yet go in where the caret is (at the end with none)
  const at = sel ? sel.a : value.length;
  const caret = (
    <span key="caret" data-testid="voice-caret" aria-hidden className="relative inline-block h-[1.15em] w-0 align-[-0.18em]">
      <i className={`absolute -left-px top-0 h-full w-[2px] rounded-full ${light ? 'bg-rose-500' : 'bg-[#ffd0dc]'}`} style={{ animation: 'voice-caret 1s steps(2) infinite' }} />
    </span>
  );
  const mid = interim ? (
    <span key="interim" className="opacity-60">
      {interim}
    </span>
  ) : null;
  const noSelect: CSSProperties = { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' };
  const btn = `inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition active:scale-95 disabled:opacity-35 ${
    light ? 'border-slate-300 bg-white text-slate-700' : 'border-[rgba(210,220,255,.35)] bg-[rgba(16,22,64,.6)] text-[#f4f1ff]'
  }`;
  return (
    <>
      <p ref={root} data-testid={testId} data-sel={sel ? `${sel.a}-${sel.b}` : ''} aria-label={EDIT_WORDS.label} className={`cursor-text whitespace-pre-wrap break-words ${className}`} style={noSelect}>
        {list.map((c) => {
          const on = range && c.o >= sel!.a && c.e <= sel!.b;
          return [
            c.o === at && (sel && !range ? caret : null),
            c.o === at && mid,
            <span key={c.o} data-o={c.o} data-e={c.e} className={on ? (light ? 'rounded-[3px] bg-rose-200 text-slate-900' : 'rounded-[3px] bg-[#ffd0dc] text-[#070b24] [text-shadow:none]') : undefined}>
              {c.ch}
            </span>,
          ];
        })}
        {at >= value.length && (sel && !range ? caret : null)}
        {at >= value.length && mid}
      </p>
      {sel && !locked && (
        <div className={`flex items-center justify-center gap-2 ${toolClass}`} data-testid="voice-tools">
          <button type="button" className={btn} onClick={edit.del} disabled={!range && sel.a === 0} data-testid={range ? 'voice-del-range' : 'voice-del'}>
            <EraseGlyph />
            {range ? EDIT_WORDS.delRange : EDIT_WORDS.del}
          </button>
        </div>
      )}
      {showHint && !sel && !locked && (
        <div className={`text-center text-[11.5px] leading-relaxed ${light ? 'text-slate-500' : 'text-[#cdd3f5]/85 [text-shadow:0_1px_3px_rgba(0,0,0,.7)]'} ${toolClass}`} data-testid="voice-edit-hint">
          {EDIT_WORDS.hint}
        </div>
      )}
    </>
  );
}
