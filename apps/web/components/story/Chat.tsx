'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useHint } from './parts';

/**
 * The story as a chat (client decision 2026-10-19: 「チャット形式」 is the main axis — it speaks to 15–20 year
 * olds). The scene stays full-screen behind; the conversation stacks up from the bottom like a messenger
 * thread: the characters on the left with their faces, your own words on the right, the place's signals in
 * the middle. A new line types in after a moment of "…", older lines fade upwards. What you can say comes
 * up as reply suggestions; a name is typed in the message bar. Everything stays small and quiet (UI 19):
 * tap anywhere to go on, nothing but the art while a scene plays.
 */

export type ChatEntry =
  | { id: string; kind: 'them'; who: string; name: string; text: string; avatar?: Avatar }
  | { id: string; kind: 'me'; text: string; action?: boolean }
  | { id: string; kind: 'sys'; text: string };

export interface Avatar {
  src: string;
  /** object-position of the face in the picture */
  pos?: string;
  /** how far the picture is zoomed in to show the face */
  zoom?: number;
  /** the picture is a full scene (dark background) rather than a cut-out */
  dark?: boolean;
}

/** every word of the story in Mincho (client 2026-10-20) */
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const SANS = SERIF;

/** The live state of the newest line (typing / revealed), so a tap can finish it first. */
export interface ChatReveal {
  done: boolean;
  finish: () => void;
}

export function ChatLog({
  entries,
  talking,
  reveal,
  bottom,
  live,
}: {
  entries: ChatEntry[];
  /** the newest speaker's voice is playing */
  talking: boolean;
  reveal: React.MutableRefObject<ChatReveal>;
  /** room left at the bottom for the replies / message bar (px) */
  bottom: number;
  /** the newest line is the one being read now (shows the tap mark when it is done) */
  live: boolean;
}) {
  // three bubbles at most; the older ones fade and shrink fast so they don't sit over the standing pictures (story chat, 2026-10-26)
  const shown = entries.slice(-3);
  const last = shown[shown.length - 1];
  // the typing state belongs to the newest line only: a caption or a reply on top leaves nothing to finish
  if (last?.kind !== 'them') reveal.current = { done: true, finish: () => undefined };
  return (
    // fades in with the shade under it (QA 11 R35: the gradient popped in)
    <div
      className="pointer-events-none absolute inset-x-0 z-[11] flex flex-col justify-end px-3.5 animate-[chatShade_0.45s_ease-out]"
      style={{
        bottom: `calc(${bottom}px + env(safe-area-inset-bottom))`,
        top: '18%',
        fontFamily: SANS,
        background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.28) 45%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, #000 0%, #000 62%, transparent 100%)',
        maskImage: 'linear-gradient(to top, #000 0%, #000 62%, transparent 100%)',
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
        {shown.map((e, k) => {
          const age = shown.length - 1 - k;
          const prev = shown[k - 1];
          const grouped = e.kind === 'them' && prev?.kind === 'them' && prev.who === e.who;
          return (
            <div key={e.id} style={{ opacity: age === 0 ? 1 : age === 1 ? 0.5 : 0.22, transform: age ? `scale(${age === 1 ? 0.95 : 0.9})` : undefined, transformOrigin: e.kind === 'me' ? 'bottom right' : 'bottom left', transition: 'opacity 400ms ease, transform 400ms ease' }}>
              {e.kind === 'sys' ? (
                <SysLine text={e.text} />
              ) : e.kind === 'me' ? (
                <MyLine text={e.text} action={e.action} />
              ) : (
                <TheirLine entry={e} grouped={grouped} fresh={e === last} talking={talking && e === last} reveal={e === last ? reveal : null} live={live && e === last} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SysLine({ text }: { text: string }) {
  return (
    <div className="flex animate-[chatIn_0.6s_cubic-bezier(.2,.8,.2,1)_both] items-center justify-center gap-3 py-1.5">
      <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-200/50" />
      <p className="whitespace-pre-line text-center text-[12.5px] tracking-[0.28em] text-amber-100/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]" style={{ fontFamily: SERIF }}>
        {text}
      </p>
      <span className="h-px w-10 bg-gradient-to-l from-transparent to-amber-200/50" />
    </div>
  );
}

function MyLine({ text, action }: { text: string; action?: boolean }) {
  return (
    <div className="flex animate-[chatInR_0.38s_cubic-bezier(.2,.8,.2,1)_both] justify-end pl-14">
      {action ? (
        <p className="rounded-full border border-amber-200/50 bg-black/35 px-3.5 py-1.5 text-[13px] tracking-wider text-amber-100 backdrop-blur-md">✦ {text}</p>
      ) : (
        <p
          className="max-w-[78%] whitespace-pre-line rounded-[18px] rounded-tr-[5px] px-3.5 py-2 text-[15px] font-medium leading-[1.6] text-[#2b1b06] shadow-[0_6px_22px_rgba(230,170,70,0.35)]"
          style={{ background: 'linear-gradient(135deg, #fbe9b7 0%, #f0c873 55%, #d79d45 100%)' }}
        >
          {text}
        </p>
      )}
    </div>
  );
}

function TheirLine({
  entry,
  grouped,
  fresh,
  talking,
  reveal,
  live,
}: {
  entry: Extract<ChatEntry, { kind: 'them' }>;
  grouped: boolean;
  fresh: boolean;
  talking: boolean;
  reveal: React.MutableRefObject<ChatReveal> | null;
  live: boolean;
}) {
  // the society's name never breaks across lines
  const chars = [...entry.text.replace(/Obolo Order/g, 'Obolo\u00a0Order')];
  // a moment of "…" before the words (shorter for short lines), then they type in
  const [phase, setPhase] = useState<'dots' | 'typing' | 'done'>(fresh ? 'dots' : 'done');
  const [n, setN] = useState(fresh ? 0 : chars.length);
  useEffect(() => {
    if (phase === 'dots') {
      const t = setTimeout(() => setPhase('typing'), Math.min(260 + chars.length * 9, 720));
      return () => clearTimeout(t);
    }
    if (phase === 'typing') {
      if (n >= chars.length) return setPhase('done');
      const t = setTimeout(() => setN((x) => x + 1), chars[n] === '\n' ? 90 : 26);
      return () => clearTimeout(t);
    }
  }, [phase, n, chars]);
  if (reveal) {
    reveal.current = {
      done: phase === 'done',
      finish: () => {
        setN(chars.length);
        setPhase('done');
      },
    };
  }
  return (
    <div className={`flex items-end gap-2 pr-10 ${fresh ? 'animate-[chatIn_0.38s_cubic-bezier(.2,.8,.2,1)_both]' : ''}`}>
      <div className="w-9 shrink-0">{!grouped && <Face avatar={entry.avatar} name={entry.name} talking={talking} />}</div>
      <div className="min-w-0">
        {!grouped && (
          <p className="mb-1 ml-1 text-[10.5px] tracking-[0.22em] text-amber-200/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]" style={{ fontFamily: SERIF }}>
            {entry.name}
          </p>
        )}
        <div
          className={`relative w-fit max-w-full rounded-[18px] px-3.5 py-2 text-[15px] leading-[1.6] text-white/95 backdrop-blur-md ${grouped ? 'rounded-tl-[18px]' : 'rounded-tl-[5px]'}`}
          style={{
            background: 'linear-gradient(180deg, rgba(38,28,56,0.80), rgba(14,10,24,0.80))',
            border: '1px solid rgba(240,205,140,0.22)',
            boxShadow: '0 8px 26px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {phase === 'dots' ? (
            <span className="flex h-[24px] items-center gap-1 px-1" aria-label="…">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 rounded-full bg-amber-100/80" style={{ animation: `typingDot 1s ${d * 0.16}s ease-in-out infinite` }} />
              ))}
            </span>
          ) : (
            <p className="whitespace-pre-line [word-break:keep-all] [overflow-wrap:anywhere]">
              {chars.slice(0, n).join('')}
              {phase === 'typing' && <span className="invisible">{chars.slice(n).join('')}</span>}
              {live && phase === 'done' && <span className="ml-1 inline-block h-1.5 w-1.5 animate-[cueBlink_1.1s_ease-in-out_infinite] rounded-full bg-amber-200 align-middle shadow-[0_0_6px_rgba(255,214,140,0.9)]" />}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Face({ avatar, name, talking }: { avatar?: Avatar; name: string; talking: boolean }) {
  return (
    <span className={`relative block h-9 w-9 rounded-full p-[1.5px] ${talking ? 'animate-[faceTalk_0.9s_ease-in-out_infinite]' : ''}`} style={{ background: 'linear-gradient(140deg, #fff1c4, #c9923a 55%, #6b4a1c)' }}>
      <span className={`block h-full w-full overflow-hidden rounded-full ${avatar?.dark ? 'bg-black' : 'bg-[radial-gradient(circle_at_50%_35%,#3b2c52,#120c1c)]'}`}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: avatar.pos ?? '50% 20%', transform: `scale(${avatar.zoom ?? 1})`, transformOrigin: avatar.pos ?? '50% 20%' }} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[13px] text-amber-100/80" style={{ fontFamily: SERIF }}>
            {name === '？？？' ? '?' : name.slice(0, 1)}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * What you can say / do now, as reply suggestions on your side. The tapped one becomes your line (the
 * caller adds it to the thread). The first few glow softly so it is clear they are there.
 */
export function ReplyChips({ options, onPick, action }: { options: string[]; onPick: (k: number) => void; action?: boolean }) {
  const hint = useHint();
  const [said, setSaid] = useState<number | null>(null);
  return (
    <div className="pb-safe pointer-events-none absolute inset-x-0 bottom-0 z-[12] px-3.5" style={{ fontFamily: SANS }}>
      <div className="mx-auto mb-5 flex max-w-md flex-wrap justify-end gap-2">
        {options.map((o, k) => (
          <button
            key={o}
            data-reply
            disabled={said !== null}
            onClick={() => {
              if (said !== null) return;
              setSaid(k);
              setTimeout(() => onPick(k), 260);
            }}
            className={`pointer-events-auto rounded-full border px-4 py-2.5 text-[14.5px] tracking-wide backdrop-blur-md transition duration-200 active:scale-95 ${
              said === k ? 'border-amber-100 bg-amber-200/90 text-[#2b1b06]' : said !== null ? 'border-white/10 bg-black/30 text-white/30' : 'border-amber-200/45 bg-[rgba(16,11,26,0.62)] text-amber-50'
            }`}
            style={{ opacity: 0, animation: `chatInR 0.4s ${0.12 + k * 0.09}s cubic-bezier(.2,.8,.2,1) forwards${hint && said === null ? `, hintGlow 2.2s ${0.6 + k * 0.25}s ease-in-out infinite` : ''}` }}
          >
            {action && <span className="mr-1.5 text-amber-200">✦</span>}
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The message bar: a name (or words) typed in and sent like a message. */
export function MessageBar({
  placeholder,
  initial = '',
  valid = () => true,
  note,
  onSend,
}: {
  placeholder: string;
  initial?: string;
  valid?: (v: string) => boolean;
  note?: (v: string) => ReactNode;
  onSend: (v: string) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 450);
    return () => clearTimeout(t);
  }, []);
  const ok = !!v.trim() && valid(v) && !busy;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await onSend(v.trim());
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="pb-safe absolute inset-x-0 bottom-0 z-[12] px-3" style={{ fontFamily: SANS }}>
      <div className="mx-auto mb-3 max-w-md animate-[chatIn_0.45s_cubic-bezier(.2,.8,.2,1)_both]">
        <div className="mb-1.5 min-h-[18px] px-2 text-right">{err ? <p className="text-xs text-rose-300">{err}</p> : note?.(v)}</div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200/30 bg-[rgba(16,11,26,0.72)] p-1.5 pl-4 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <input
            ref={input}
            value={v}
            onChange={(e) => setV(e.target.value)}
            maxLength={24}
            placeholder={placeholder}
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-amber-50 outline-none placeholder:text-white/35"
          />
          <button
            type="submit"
            disabled={!ok}
            aria-label="送る"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-35"
            style={{ background: 'linear-gradient(135deg, #fbe9b7, #d79d45)' }}
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2b1b06]/30 border-t-[#2b1b06]" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#2b1b06]" aria-hidden>
                <path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
