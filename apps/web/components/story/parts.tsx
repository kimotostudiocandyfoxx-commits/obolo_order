'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * The story's UI parts (production UI 6 + 19, 2026-10-15). The rule (client): the motion is anime, the
 * parts are as small and quiet as they can be.
 *  - lines: a thin translucent band over the picture, a small name, tap anywhere to go on (a blinking mark)
 *  - titles: like film subtitles — thin letters that come and go, no band
 *  - choices and actions: small speech bubbles from your side; tapping one is saying it
 *  - a big, clear button only at a moment of decision (paying, agreeing how a voice is used): DecisionButton
 *  - the first few times, what can be tapped glows softly; the touch area is larger than it looks
 * The painted frames (Seedream, public/ui/parts) are kept for the decision button.
 * /kakunin-5798f28713/parts shows them all.
 */
const P = (id: string) => `/ui/parts/${id}.webp`;
export const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** border-image: `slice` in the picture's pixels (top right bottom left), `width` on screen */
const frame = (id: string, slice: string, width: string): CSSProperties => ({
  borderStyle: 'solid',
  borderWidth: width,
  borderImage: `url(${P(id)}) ${slice} fill / ${width} / 0 stretch`,
});

/** The first few prompts glow so it is clear where to tap (then never again on this device). */
const HINT_KEY = 'obolo.story.hints';
export function useHint(): boolean {
  const [on] = useState(() => {
    try {
      const n = Number(localStorage.getItem(HINT_KEY) ?? 0);
      localStorage.setItem(HINT_KEY, String(n + 1));
      return n < 4;
    } catch {
      return false;
    }
  });
  return on;
}

/** A spoken line: a thin translucent band over the picture with a small name. */
export function DialogueWindow({ name, children, done, style }: { name?: string; children: ReactNode; done?: boolean; style?: CSSProperties }) {
  return (
    <div className="relative mx-auto w-full max-w-xl" style={{ fontFamily: SERIF, ...style }}>
      <div className="relative bg-[linear-gradient(180deg,rgba(6,5,10,0)_0%,rgba(6,5,10,0.55)_18%,rgba(6,5,10,0.62)_100%)] px-5 pb-4 pt-3 text-left text-amber-50">
        <span className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(245,212,138,0.55),transparent)]" />
        {name && <NamePlate name={name} />}
        <p className="min-h-[3.4em] whitespace-pre-wrap text-[16.5px] leading-[1.75] tracking-[0.04em] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{children}</p>
        {done && <NextMark />}
      </div>
    </div>
  );
}

export function NamePlate({ name }: { name: string }) {
  return <span className="mb-0.5 block text-[11.5px] tracking-[0.3em] text-amber-200/90 [text-shadow:0_0_6px_rgba(255,200,110,0.45)]">{name}</span>;
}

/** A small blinking mark at the end: the line is all out, tap anywhere. */
export function NextMark() {
  return <span className="absolute bottom-3 right-4 block h-1.5 w-1.5 animate-[nextBob_1.2s_ease-in-out_infinite] rounded-full bg-amber-200 shadow-[0_0_8px_2px_rgba(255,210,120,0.7)]" aria-hidden />;
}

/** 〔テロップ：…〕 like a film subtitle: thin letters that come and go, no band. */
export function Telop({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <p className="mx-auto max-w-[90vw] animate-[subIn_2.6s_ease-out_both] text-center text-[clamp(14px,4vw,19px)] font-light tracking-[0.35em] text-amber-50/95 [text-shadow:0_0_14px_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.9)]" style={{ fontFamily: SERIF, ...style }}>
      {text}
    </p>
  );
}

/**
 * A choice (or the story's action, 〔ボタン：封を開く〕): a small speech bubble from your side.
 * `k` staggers bubbles that come up together; `hint` glows softly.
 */
export function Choice({ children, onClick, on = false, disabled = false, k = 0, hint = false, type = 'button' }: { children: ReactNode; onClick?: () => void; on?: boolean; disabled?: boolean; k?: number; hint?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="group relative -m-2 block p-2 text-right disabled:opacity-40"
      style={{ animation: `bubbleIn 0.45s ease-out ${0.12 * k}s both`, fontFamily: SERIF }}
    >
      <span
        className={`relative inline-block max-w-[78vw] rounded-[18px] rounded-br-[5px] border px-4 py-2 text-left text-[15px] leading-snug tracking-[0.06em] [word-break:keep-all] transition-colors ${on ? 'border-amber-200/80 bg-amber-200/90 text-[#2a1600]' : 'border-amber-100/35 bg-[rgba(10,8,14,0.62)] text-amber-50 group-active:border-amber-200/80 group-active:bg-amber-200/25'}`}
        style={hint && !on ? { animation: 'hintGlow 1.8s ease-in-out infinite' } : undefined}
      >
        {children}
      </span>
    </button>
  );
}
/** The story's own actions use the same bubble. */
export const ActionButton = ({ children, onClick, disabled = false, type = 'button', hint = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; hint?: boolean }) => (
  <Choice onClick={onClick} disabled={disabled} type={type} hint={hint}>
    {children}
  </Choice>
);

/** The one big, clear button — only at a moment of decision (paying, agreeing how a voice is used). */
export function DecisionButton({ children, onClick, disabled = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative block w-full text-center text-[17px] tracking-[0.18em] text-amber-50 transition-opacity [text-shadow:0_0_10px_rgba(255,200,110,0.55)] [word-break:keep-all] active:opacity-80 disabled:opacity-40"
      style={{ fontFamily: SERIF, ...frame('button', '90 170 90 170', '20px 40px') }}
    >
      <span className="block py-2">{children}</span>
    </button>
  );
}

/** A typed answer (name, food, …): a thin line, no box. */
export function FieldFrame({ children }: { children: ReactNode }) {
  return <div className="relative w-full border-b border-amber-100/45 pb-0.5 focus-within:border-amber-200/90">{children}</div>;
}

/** Round gold icon buttons (sound on / off, the riddle book). Drawn in SVG until the painted medallions arrive. */
export function IconButton({ icon, onClick, label, style }: { icon: 'sound' | 'mute' | 'book' | 'mixer'; onClick: () => void; label: string; style?: CSSProperties }) {
  return (
    <button onClick={onClick} aria-label={label} className="relative -m-1.5 flex h-11 w-11 items-center justify-center rounded-full opacity-55 transition-opacity active:opacity-100" style={style}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" fill="none" stroke="#f3d08a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon === 'book' ? (
          <>
            <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
            <path d="M5 17a3 3 0 0 1 3-3h10" />
            <path d="M11.5 7.5l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="#f3d08a" strokeWidth="0.6" />
          </>
        ) : icon === 'mixer' ? (
          <>
            <path d="M6 4v16M12 4v16M18 4v16" />
            <circle cx="6" cy="14" r="2" fill="#0b0805" />
            <circle cx="12" cy="8" r="2" fill="#0b0805" />
            <circle cx="18" cy="16" r="2" fill="#0b0805" />
          </>
        ) : (
          <>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            {icon === 'sound' ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9l5 6M21 9l-5 6" />}
          </>
        )}
      </svg>
    </button>
  );
}

/** The three volumes (music / sounds / voices), kept on this device. */
export function MixerPanel({
  mix,
  onChange,
  onClose,
  noWait,
  onNoWait,
}: {
  mix: { bgm: number; se: number; voice: number };
  onChange: (m: { bgm: number; se: number; voice: number }) => void;
  onClose?: () => void;
  /** "声を待たずに進む" (M-R102): kept at the bottom, for playing without hearing the voices */
  noWait?: boolean;
  onNoWait?: (on: boolean) => void;
}) {
  const rows: { key: 'bgm' | 'se' | 'voice'; label: string }[] = [
    { key: 'bgm', label: '音楽' },
    { key: 'se', label: '効果音' },
    { key: 'voice', label: '声' },
  ];
  return (
    <div className="w-[min(86vw,340px)] rounded-2xl border border-amber-100/20 bg-[rgba(8,6,12,0.82)] px-5 py-5 text-amber-50 backdrop-blur-sm" style={{ fontFamily: SERIF }}>
      <p className="mb-3 text-center text-sm tracking-[0.4em] text-amber-200">音の大きさ</p>
      {rows.map((r) => (
        <label key={r.key} className="mb-3 flex items-center gap-3 text-[14px] tracking-[0.15em]">
          <span className="w-14 shrink-0">{r.label}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mix[r.key]}
            onChange={(e) => onChange({ ...mix, [r.key]: Number(e.target.value) })}
            className="story-range h-6 min-w-0 flex-1"
            aria-label={r.label}
          />
        </label>
      ))}
      {onNoWait && (
        <label className="mt-4 flex items-center justify-between gap-3 border-t border-amber-100/10 pt-3 text-[12px] tracking-[0.12em] text-amber-50/70">
          <span>
            声を待たずに進む
            <span className="block text-[10px] tracking-normal text-amber-50/40">声が聞こえにくい時や、音を出せない場所で</span>
          </span>
          <input type="checkbox" checked={!!noWait} onChange={(e) => onNoWait(e.target.checked)} className="h-5 w-5 accent-amber-300" />
        </label>
      )}
      {onClose && (
        <div className="mx-auto mt-2 w-40">
          <Choice onClick={onClose}>とじる</Choice>
        </div>
      )}
    </div>
  );
}
