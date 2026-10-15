'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * The story's UI parts (production UI 6, 2026-10-15): painted without letters (Seedream,
 * design/ui-parts-queue.json → public/ui/parts/<id>.webp) and stretched with border-image so the ornate
 * ends and corners keep their shape. Dark fantasy + gold light; nothing that looks like a web button.
 * /preview/parts shows them all.
 */
const P = (id: string) => `/ui/parts/${id}.webp`;
export const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** border-image: `slice` in the picture's pixels (top right bottom left), `width` on screen */
const frame = (id: string, slice: string, width: string): CSSProperties => ({
  borderStyle: 'solid',
  borderWidth: width,
  borderImage: `url(${P(id)}) ${slice} fill / ${width} / 0 stretch`,
});

/** The dialogue window, with the speaker's name plate on its upper left. */
export function DialogueWindow({ name, children, done, style }: { name?: string; children: ReactNode; done?: boolean; style?: CSSProperties }) {
  return (
    <div className="relative mx-auto w-full max-w-xl" style={{ fontFamily: SERIF, ...style }}>
      <div className="relative min-h-[8.5rem] px-2 pb-3 pt-4 text-left text-amber-50" style={frame('dialog', '70 70 70 70', '22px')}>
        <p className="whitespace-pre-wrap text-[17px] leading-[1.75] tracking-[0.04em] [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{children}</p>
        {done && <NextMark />}
      </div>
      {name && (
        <div className="absolute -top-5 left-3">
          <NamePlate name={name} />
        </div>
      )}
    </div>
  );
}

export function NamePlate({ name }: { name: string }) {
  return (
    <span className="inline-block min-w-[7rem] px-1 text-center text-[13px] font-bold leading-6 tracking-[0.25em] text-amber-200 [text-shadow:0_0_8px_rgba(255,200,110,0.5)]" style={{ fontFamily: SERIF, ...frame('nameplate', '40 90 40 90', '8px 22px') }}>
      {name}
    </span>
  );
}

/** A small jewel arrow: the line is all out, tap to go on. */
export function NextMark() {
  return (
    <span className="absolute bottom-1 right-2 block h-3.5 w-3.5 animate-[nextBob_1.2s_ease-in-out_infinite]" aria-hidden>
      <svg viewBox="0 0 20 20" className="h-full w-full drop-shadow-[0_0_6px_rgba(255,210,120,0.9)]">
        <path d="M3 5 L10 15 L17 5 L10 8 Z" fill="#f5d48a" stroke="#fff3cf" strokeWidth="0.8" />
      </svg>
    </span>
  );
}

/** A title across the screen: 〔テロップ：…〕 (1日目, 本部に到着しました, MONBANが現れた, …). */
export function Telop({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <div className="relative mx-auto flex aspect-[7/1] w-[min(92vw,560px)] items-center justify-center bg-[length:100%_100%] bg-no-repeat px-[9%]" style={{ backgroundImage: `url(${P('telop')})`, fontFamily: SERIF, ...style }}>
      <span className="truncate text-[clamp(15px,4.4vw,22px)] tracking-[0.22em] text-amber-100 [text-shadow:0_0_12px_rgba(255,200,110,0.6)]">{text}</span>
    </div>
  );
}

/** A choice. `on` = the one being pressed / picked. */
export function Choice({ children, onClick, on = false, disabled = false }: { children: ReactNode; onClick?: () => void; on?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative block w-full text-center text-[16px] tracking-[0.12em] [word-break:keep-all] transition-opacity disabled:opacity-40 ${on ? 'text-[#2a1600]' : 'text-amber-50'}`}
      style={{ fontFamily: SERIF, ...frame(on ? 'choice-on' : 'choice', on ? '70 110 70 110' : '40 90 40 90', on ? '22px 44px' : '14px 34px') }}
    >
      <span className={`relative block py-1.5 ${on ? 'font-bold' : ''}`}>{children}</span>
      {!on && <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-active:opacity-100" style={frame('choice-on', '70 110 70 110', '22px 44px')} aria-hidden />}
    </button>
  );
}

/** The one big action of a moment (〔ボタン：封を開く〕, 名乗る, …). */
export function ActionButton({ children, onClick, disabled = false, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="relative block w-full text-center text-[17px] tracking-[0.18em] text-amber-50 transition-opacity [text-shadow:0_0_10px_rgba(255,200,110,0.55)] [word-break:keep-all] active:opacity-80 disabled:opacity-40"
      style={{ fontFamily: SERIF, ...frame('button', '90 170 90 170', '20px 40px') }}
    >
      <span className="block py-2">{children}</span>
    </button>
  );
}

/** A text box in the story's frame (typed answers: name, food, …). */
export function FieldFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full" style={frame('field', '40 150 40 150', '12px 40px')}>
      {children}
    </div>
  );
}

/** Round gold icon buttons (sound on / off, the riddle book). Drawn in SVG until the painted medallions arrive. */
export function IconButton({ icon, onClick, label, style }: { icon: 'sound' | 'mute' | 'book' | 'mixer'; onClick: () => void; label: string; style?: CSSProperties }) {
  return (
    <button onClick={onClick} aria-label={label} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/70 bg-[radial-gradient(circle_at_35%_30%,#2b2215,#0b0805_70%)] shadow-[0_0_14px_rgba(255,200,110,0.35),inset_0_0_0_2px_rgba(0,0,0,0.6)] active:opacity-80" style={style}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#f3d08a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
export function MixerPanel({ mix, onChange, onClose }: { mix: { bgm: number; se: number; voice: number }; onChange: (m: { bgm: number; se: number; voice: number }) => void; onClose?: () => void }) {
  const rows: { key: 'bgm' | 'se' | 'voice'; label: string }[] = [
    { key: 'bgm', label: '音楽' },
    { key: 'se', label: '効果音' },
    { key: 'voice', label: '声' },
  ];
  return (
    <div className="w-[min(86vw,340px)] px-4 py-4 text-amber-50" style={{ fontFamily: SERIF, ...frame('dialog', '70 70 70 70', '22px') }}>
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
      {onClose && (
        <div className="mx-auto mt-2 w-40">
          <Choice onClick={onClose}>とじる</Choice>
        </div>
      )}
    </div>
  );
}
