'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { lyricBlockKeys, lyricBlockLabels, lyricHintLabel, lyricSectionLabel, lyricSectionSung, type LyricHint, type LyricSection, type LyricsChange, type SongLyrics } from '@obolo/shared';
import { face, LOOK_CSS, useSpellFont } from './spellLooks';

/**
 * R13 (client 2026-11-25): 「メタタグもスペルにして、きれいに見せて」 — the second part of a song's spell, スペル入りの歌詞, as a
 * scene element in the temple sky (no card, no buttons), under the style talismans: a light, translucent lyric sheet
 * in the D look (光符: paper lit from within by the bowl's water light), a faint stave behind each block. Each block opens
 * with its metatag talisman (〔Aメロ〕〔サビ〕…) and its performance talismans (〔ささやき〕〔ハモり〕…, smaller, a violet drop
 * of light); the English tag behind each is never shown. The sheet scrolls by itself when the song is long.
 * A change: changed lines glow, removed tags fall away (light melting upward), new tags drop in; the sheet scrolls to the
 * first change.
 */
export type FloatLyrics = { lyrics: SongLyrics; change?: LyricsChange; /** a new key per change (the motions start again) */ v: number };

const seedOf = (s: string) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);

const CSS = `
@keyframes ls-in{0%{opacity:0;transform:translateY(16px) scale(.97);filter:blur(6px) brightness(1.6)}100%{opacity:1;transform:none;filter:none}}
@keyframes ls-row{0%{opacity:0;transform:translateY(8px);filter:blur(3px)}100%{opacity:1;transform:none;filter:none}}
@keyframes ls-glow{0%{background-color:rgba(160,235,255,0);text-shadow:0 0 1px #fff,0 0 4px #9becff,0 0 9px rgba(63,182,255,.6)}25%{background-color:rgba(160,235,255,.26);text-shadow:0 0 2px #fff,0 0 9px #c4f4ff,0 0 20px #3fb6ff,0 0 32px rgba(120,200,255,.9)}100%{background-color:rgba(160,235,255,.1);text-shadow:0 0 1px #fff,0 0 5px #9becff,0 0 12px rgba(63,182,255,.75)}}
@keyframes ls-shimmer{0%{background-position:-120% 0}100%{background-position:220% 0}}
@keyframes ls-mote{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:.9;transform:translateY(-6px)}}
@keyframes ls-tag-gone{0%{opacity:1;filter:none;transform:none;max-height:40px}40%{opacity:1;filter:brightness(2.2) blur(1px)}100%{opacity:0;filter:brightness(3) blur(8px);transform:translateY(-24px) scale(1.15);max-height:0}}
@media (prefers-reduced-motion: reduce){[data-lyric-sheet] *{animation-iteration-count:1!important}}
`;

/** a metatag talisman: the block's structure (bright paper of light) or a performance touch (smaller, a violet drop) */
function MetaTag({ label, kind, mode, delay, testid }: { label: string; kind: 'section' | 'hint'; mode: 'still' | 'drop' | 'fall'; delay: number; testid?: string }) {
  const seed = seedOf(label);
  const tilt = (((seed % 7) - 3) * 0.5).toFixed(1);
  const hint = kind === 'hint';
  const anim = mode === 'drop' ? `hk-in .95s cubic-bezier(.2,.8,.3,1) ${delay}ms both` : mode === 'fall' ? `ls-tag-gone 1.1s ease-in ${delay}ms forwards` : `ls-row .6s ease-out ${delay}ms both`;
  return (
    <span className="relative inline-block align-middle" style={{ ['--tilt' as string]: `${tilt}deg`, animation: anim }} data-lyric-tag={label} data-lyric-tag-kind={kind} data-lyric-tag-mode={mode} data-testid={testid}>
      <span className="block" style={{ animation: `hk-glow ${3.4 + (seed % 5) * 0.3}s ease-in-out ${(seed % 7) * -400}ms infinite`, transform: `rotate(${tilt}deg)` }}>
        <span
          className="relative flex items-center gap-[3px] whitespace-nowrap"
          style={{
            height: hint ? 21 : 25,
            padding: hint ? '0 6px 0 4px' : '0 7px 0 5px',
            borderRadius: 2,
            background: hint
              ? 'linear-gradient(180deg, rgba(196,170,255,.26), rgba(120,90,230,.16) 55%, rgba(196,170,255,.26))'
              : 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(200,245,255,.26), transparent 80%), linear-gradient(180deg, rgba(110,200,255,.3), rgba(40,120,220,.2) 55%, rgba(110,200,255,.32))',
            boxShadow: hint ? 'inset 0 0 6px rgba(225,210,255,.45), inset 0 0 0 1px rgba(230,215,255,.55)' : 'inset 0 0 7px rgba(200,245,255,.6), inset 0 0 0 1px rgba(210,248,255,.7)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          <span aria-hidden className="block shrink-0 rounded-full" style={{ width: hint ? 5 : 6, height: hint ? 5 : 6, background: hint ? 'radial-gradient(circle, #fff 0 30%, #d9c6ff 55%, transparent 72%)' : 'radial-gradient(circle, #fff 0 30%, #9ff0ff 55%, transparent 72%)', boxShadow: hint ? '0 0 5px #b89cff' : '0 0 6px #6fe0ff' }} />
          <span className="leading-none tracking-[.04em]" style={{ fontFamily: face('hikari'), fontSize: hint ? 11.5 : 13.5, paddingTop: 1, color: hint ? '#f6f0ff' : '#f8feff', textShadow: hint ? '0 0 1px #fff, 0 0 4px #c9b4ff, 0 0 9px rgba(140,100,255,.6)' : '0 0 1px #fff, 0 0 4px #9becff, 0 0 9px #3fb6ff' }}>
            {label}
          </span>
        </span>
      </span>
    </span>
  );
}

/** a block's tag row: its metatag, its performance tags (new ones drop in, removed ones fall away) */
function TagRow({ label, hints, gone, fresh, newHints, delay }: { label: string; hints: LyricHint[]; gone: LyricHint[]; fresh: boolean; newHints: Set<string>; delay: number }) {
  return (
    <span className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
      <MetaTag label={label} kind="section" mode={fresh ? 'drop' : 'still'} delay={delay} />
      {hints.map((h, i) => (
        <MetaTag key={`h-${h}`} label={lyricHintLabel(h)} kind="hint" mode={fresh || newHints.has(h) ? 'drop' : 'still'} delay={delay + 160 + i * 140} />
      ))}
      {gone.map((h, i) => (
        <MetaTag key={`g-${h}`} label={lyricHintLabel(h)} kind="hint" mode="fall" delay={120 + i * 120} />
      ))}
    </span>
  );
}

/**
 * the sheet: `cx` its centre line, `top` / `height` its place in the stage (stage px), `width` its width. The rows come in
 * one by one the first time; afterwards only what changed moves.
 */
export function LyricSheet({ sheet, cx, top, width, height, casting }: { sheet: FloatLyrics; cx: number; top: number; width: number; height: number; casting?: boolean }) {
  useSpellFont('hikari');
  const { lyrics, change } = sheet;
  const labels = useMemo(() => lyricBlockLabels(lyrics), [lyrics]);
  const keys = useMemo(() => lyricBlockKeys(lyrics), [lyrics]);
  const box = useRef<HTMLDivElement>(null);
  const first = !change;
  const newBlocks = new Set(change?.newBlocks ?? []);
  const changed = new Set(change?.changedLines ?? []);
  const newHintsOf = (k: string) => new Set((change?.newHints ?? []).filter((x) => x.startsWith(`${k}/`)).map((x) => x.slice(k.length + 1)));
  const goneHintsOf = (k: string) => (change?.goneHints ?? []).filter((g) => g.key === k).map((g) => g.hint);
  const goneAt = (i: number) => (change?.goneBlocks ?? []).filter((g) => g.at === i);
  // the first change in view (a glowing line, a new tag); else the top
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const hit = el.querySelector<HTMLElement>('[data-lyric-new], [data-lyric-changed], [data-lyric-tag-mode=drop], [data-lyric-tag-mode=fall]');
    if (change && hit) {
      const y = hit.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - el.clientHeight * 0.3;
      el.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    } else if (!change) el.scrollTo({ top: 0 });
  }, [sheet.v, change]);
  let row = 0;
  const step = first ? 150 : 0;
  const ghost = (g: { key: string; section: LyricSection; hints: LyricHint[] }) => (
    <div key={`ghost-${g.key}`} className="mb-1" data-lyric-gone={g.key}>
      <span className="flex flex-wrap items-center gap-x-[7px]">
        <MetaTag label={lyricSectionLabel(g.section)} kind="section" mode="fall" delay={100} />
        {g.hints.map((h, i) => (
          <MetaTag key={h} label={lyricHintLabel(h)} kind="hint" mode="fall" delay={180 + i * 100} />
        ))}
      </span>
    </div>
  );
  return (
    <div
      className="pointer-events-auto absolute"
      data-lyric-sheet
      style={{ left: cx - width / 2, top, width, height, animation: 'ls-in 1.1s cubic-bezier(.25,.8,.3,1) both', opacity: casting ? 0 : 1, transform: casting ? 'translateY(40px) scale(.6)' : undefined, transition: 'opacity .7s ease-in .3s, transform .9s ease-in' }}
      aria-label={`スペル入りの歌詞：${lyrics.blocks.map((b, i) => `${labels[i]}${b.lines.length ? '、' + b.lines.join('、') : ''}`).join('。')}`}
    >
      <style>{LOOK_CSS + CSS}</style>
      {/* the paper of light: translucent, a soft rim of water light, lit from within */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          borderRadius: 14,
          background: 'linear-gradient(180deg, rgba(150,225,255,.17), rgba(70,140,230,.11) 40%, rgba(40,90,190,.13) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(205,246,255,.38), inset 0 0 22px rgba(160,230,255,.22), 0 0 28px rgba(80,180,255,.22)',
          backdropFilter: 'blur(7px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(7px) saturate(1.15)',
        }}
      />
      {/* a slow sheen across it */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: 14 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(220,250,255,.12) 50%, transparent 65%)', backgroundSize: '200% 100%', animation: 'ls-shimmer 9s ease-in-out infinite' }} />
        {[0, 1, 2, 3].map((k) => (
          <span key={k} className="absolute block h-[3px] w-[3px] rounded-full bg-white" style={{ left: `${12 + k * 25}%`, top: k % 2 ? 6 : undefined, bottom: k % 2 ? undefined : 7, boxShadow: '0 0 5px 1px #7fe3ff', animation: `ls-mote ${3 + k * 0.7}s ease-in-out ${k * -900}ms infinite` }} />
        ))}
      </div>
      <div
        ref={box}
        className="relative h-full overflow-y-auto overscroll-contain px-[14px] py-[12px]"
        style={{ WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 12px, #000 calc(100% - 16px), transparent 100%)', maskImage: 'linear-gradient(180deg, transparent 0, #000 12px, #000 calc(100% - 16px), transparent 100%)', scrollbarWidth: 'none' } as CSSProperties}
        data-testid="lyric-sheet-scroll"
      >
        {lyrics.blocks.map((b, i) => {
          const k = keys[i];
          const fresh = first || newBlocks.has(k);
          const d = row++ * step;
          return (
            <div key={`${sheet.v}-${k}`}>
              {goneAt(i).map(ghost)}
              <div className={lyricSectionSung(b.section) || b.lines.length ? 'mb-[10px]' : 'mb-[8px]'} data-lyric-block={k} {...(newBlocks.has(k) ? { 'data-lyric-new': '' } : {})}>
                <TagRow label={labels[i]} hints={b.hints} gone={goneHintsOf(k)} fresh={fresh} newHints={newHintsOf(k)} delay={first ? 200 + d : 120} />
                {!!b.lines.length && (
                  <div
                    className="relative mt-[5px] pl-[10px]"
                    style={{
                      // a faint stave behind the words: the sheet reads as a score
                      backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 6px, rgba(190,240,255,.13) 6px 7px, transparent 7px 11px)',
                      backgroundSize: '100% 100%',
                      borderLeft: '1px solid rgba(190,240,255,.28)',
                    }}
                  >
                    {b.lines.map((line, j) => {
                      const glow = changed.has(`${k}:${j}`);
                      return (
                        <p
                          key={`${j}-${line}`}
                          className="m-0 rounded-[3px] px-[3px] text-[15px] leading-[1.62] tracking-[.03em]"
                          style={{ fontFamily: face('hikari'), color: '#f4fdff', textShadow: '0 0 1px rgba(255,255,255,.9), 0 0 5px rgba(120,210,255,.75), 0 1px 2px rgba(6,20,60,.65)', animation: glow ? 'ls-glow 2.6s ease-out 250ms both' : fresh ? `ls-row .7s ease-out ${(first ? 320 + d : 220) + j * 90}ms both` : undefined, overflowWrap: 'anywhere' }}
                          {...(glow ? { 'data-lyric-changed': '' } : {})}
                        >
                          {line}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {goneAt(lyrics.blocks.length).map(ghost)}
      </div>
    </div>
  );
}

/** the talk's record of the lyrics (scrolling back still shows what was sung): 「歌詞：Aメロ・サビ前・サビ…」 */
export function LyricsRecord({ lyrics }: { lyrics: SongLyrics }) {
  const labels = lyricBlockLabels(lyrics);
  return (
    <span className="mt-0.5 block text-[11.5px] font-medium leading-snug tracking-[.04em]" style={{ color: 'var(--talk-ink, currentColor)', opacity: 0.62 }} data-testid="lyrics-record">
      歌詞：{labels.join('・')}
    </span>
  );
}
