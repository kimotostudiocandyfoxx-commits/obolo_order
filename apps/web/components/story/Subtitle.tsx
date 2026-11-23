'use client';

import { talkPlain } from '@obolo/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { Marked } from '@/components/talk/TalkScene';

/**
 * The story's lines as film subtitles (client review of M-R251, 2026-11-23: "bubbles = chat, subtitles = story"): at
 * the lower third, centred, two lines at most, large serif text on a soft dark scrim (no box), the speaker's name small
 * above it in their colour. The bubble rules become typography:
 *   slam / burst  pops in larger with a small shake      shout 「！！」  bold
 *   whisper       smaller, lighter, a little spaced       muse 「……」   fades in slowly, dimmer
 * Marks (**, ^^, [[金:…]]) are drawn as their runs (TalkScene's Marked). `shown`: the characters out so far (the
 * words come with the voice); the rest keeps its place.
 */
export type SubtitleStyle = 'plain' | 'slam' | 'shout' | 'whisper' | 'muse';
/** the marks in the subtitles' own type: a shout is bold and a little larger in the same serif (not the bubbles' poster font) */
const SUB_MARKS = { shout: { fontWeight: 800, fontSize: '1.12em' }, big: { fontWeight: 800, fontSize: '1.15em' } } as const;
export const SUB_SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** a line's style from its bubble rules (shape / in) and its punctuation */
export function subtitleStyle(text: string, shape?: string, inn?: string): SubtitleStyle {
  if (shape === 'burst' || inn === 'slam') return 'slam';
  if (shape === 'whisper') return 'whisper';
  if (shape === 'cloud' || inn === 'slow') return 'muse';
  if (/[！!]{2,}/.test(text)) return 'shout';
  return 'plain';
}

const STYLE: Record<SubtitleStyle, { text: CSSProperties; anim?: string }> = {
  plain: { text: { fontSize: 19, fontWeight: 600 }, anim: 'subIn .28s ease-out both' },
  shout: { text: { fontSize: 20, fontWeight: 800 }, anim: 'subIn .2s ease-out both' },
  slam: { text: { fontSize: 22, fontWeight: 800, lineHeight: 1.4 }, anim: 'subSlam .5s cubic-bezier(.2,1.6,.4,1) both, subShake .32s .18s ease-in-out' },
  whisper: { text: { fontSize: 16.5, fontWeight: 400, letterSpacing: '.12em', opacity: 0.88 }, anim: 'subIn .5s ease-out both' },
  muse: { text: { fontSize: 18.5, fontWeight: 500, opacity: 0.8 }, anim: 'subIn 1.1s ease-out both' },
};

export const SUBTITLE_CSS = `
@keyframes subIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@keyframes subSlam { 0% { opacity: 0; transform: scale(1.5) } 60% { opacity: 1; transform: scale(.96) } 100% { transform: none } }
@keyframes subShake { 0%,100% { translate: 0 } 25% { translate: -4px 0 } 50% { translate: 3px 0 } 75% { translate: -2px 0 } }
`;

export function Subtitle({ name, color, text, shown, style = 'plain', lineKey, dim = false }: { name?: string | null; color?: string; text: string; shown?: number; style?: SubtitleStyle; lineKey: string; dim?: boolean }) {
  const s = STYLE[style];
  return (
    <div key={lineKey} className="flex flex-col items-center text-center" style={{ animation: dim ? undefined : s.anim, opacity: dim ? 0.55 : 1 }}>
      {name && (
        <p className="mb-1 text-[12px] font-bold tracking-[0.24em]" style={{ color: color ?? '#f3e6c4', fontFamily: SUB_SERIF, textShadow: '0 1px 6px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.9)' }}>
          {name}
        </p>
      )}
      <p
        className="line-clamp-2 max-w-full whitespace-pre-line text-[#fbf6ea] [line-break:strict] [text-wrap:balance] [word-break:auto-phrase]"
        lang="ja"
        style={{ fontFamily: SUB_SERIF, lineHeight: 1.5, textShadow: '0 2px 10px rgba(0,0,0,.95), 0 0 3px rgba(0,0,0,.95), 0 1px 1px rgba(0,0,0,.9)', ...s.text, ...(dim ? { fontSize: 15 } : {}) }}
      >
        <Marked text={text} upto={shown} marks={SUB_MARKS} />
        {shown != null && <span className="invisible">{[...talkPlain(text)].slice(shown).join('')}</span>}
      </p>
    </div>
  );
}

/** the scrim the subtitles sit on: a soft dark gradient up from the bottom, no box */
export function SubtitleScrim({ bottom, height = 210 }: { bottom: number; height?: number }) {
  return <div className="pointer-events-none absolute inset-x-0 z-[8]" style={{ bottom: Math.max(0, bottom - 40), height, background: 'linear-gradient(to top, rgba(4,4,10,.72) 0%, rgba(4,4,10,.5) 45%, transparent 100%)' }} aria-hidden />;
}

/**
 * A subtitle that types in by itself (the cinema of days 1–2 tried with subtitles, ?subs=1): the words come at the
 * reading pace; `reveal` lets a tap finish them first (as the story's bubbles do).
 */
export function TypedSubtitle({ name, color, text, lineKey, reveal, live }: { name?: string | null; color?: string; text: string; lineKey: string; reveal: { current: { done: boolean; finish: () => void } }; live: boolean }) {
  const plain = [...talkPlain(text)];
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [lineKey]);
  useEffect(() => {
    if (n >= plain.length) return;
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 120 : 34);
    return () => clearTimeout(t);
  }, [n, plain.length]);
  if (live) reveal.current = { done: n >= plain.length, finish: () => setN(plain.length) };
  const st = subtitleStyle(talkPlain(text));
  return <Subtitle name={name} color={color} text={text} lineKey={lineKey} shown={n < plain.length ? n : undefined} style={st} />;
}
