'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clockFace, clockOrder, ringDash, type ClockFace } from '@/lib/atelier/castClock';
import { jobView, onJobs } from '@/lib/atelier/jobs';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { face, spellLookFor, useSpellFont, type TalismanLook } from './spellLooks';
import { TEMPLE_PLATE } from './temple';
import { KindMark } from './WorkCard';
import type { Msg, Work } from './work';

/**
 * R18 (client 2026-11-25): 「待っている間、ふつうのローディングじゃなくて — 後ろの水盤が神々しく光って、光る数字がカウントダウン
 * したり、神秘的な時計が回って、だいたいどれくらいかかるか分かるように」.
 * While a work of the talk is being made, an arcane clock (an astrolabe of rings, runes and a sweeping hand) floats in the
 * sky over the water bowl, in the talisman palette of the work's kind: its outer ring fills as the time passes, glowing
 * numerals in the middle count down (「02:41」, 「あと12分」), and once the time is up they turn to 「もうすこし…」 while it
 * keeps turning. Several works: the soonest big, the others as small sigils orbiting it. Done: the clock collapses into
 * a burst of light (the bowl lifts the work out). Transforms and opacity only; each ring is its own layer; nothing moves
 * with reduced motion (the numerals still change once a second); everything pauses while the tab is hidden.
 */

export type CastEntry = { id: string; kind: AtelierKind; jobId: string; long: boolean };
export type CastPalette = { ring: string; glow: string; accent: string; disc: string; num: string };

/** the five talisman looks' light (D 光符 cyan, B 天符 gold on indigo, C ルーン violet and parchment, A 霊符 vermilion, E 呪符 red on black) */
export const CAST_PALETTE: Record<TalismanLook, CastPalette> = {
  hikari: { ring: '#c8f6ff', glow: '120,225,255', accent: '#86e6ff', disc: 'rgba(5,28,52,.86)', num: '#f2fdff' },
  tenfu: { ring: '#ffe4a3', glow: '255,206,112', accent: '#9ea4ff', disc: 'rgba(16,18,66,.88)', num: '#fff3cf' },
  rune: { ring: '#ead6ff', glow: '186,136,255', accent: '#f4d89f', disc: 'rgba(32,14,50,.88)', num: '#f8edff' },
  reifu: { ring: '#ffd47e', glow: '255,104,56', accent: '#ff6b3d', disc: 'rgba(58,12,4,.86)', num: '#fff1d2' },
  jufu: { ring: '#ff6066', glow: '255,44,64', accent: '#ffb6ab', disc: 'rgba(14,2,4,.92)', num: '#ffe4e1' },
};
export const castPalette = (kind: string) => CAST_PALETTE[spellLookFor(kind)];

/** the works of these messages still being made by a job (the clock's entries) */
export function castEntries(msgs: Msg[]): CastEntry[] {
  const out: CastEntry[] = [];
  for (const m of msgs) if (m.who === 'work' && m.work.status === 'making' && m.work.job) out.push({ id: m.work.id, kind: m.work.kind, jobId: m.work.job.id, long: m.work.job.long });
  return out;
}

/** the tab is hidden (its animations and the count stop) */
export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

/** now, once a second (stopped while hidden), and again whenever a job is looked at */
function useNow(hidden: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (hidden) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    const off = onJobs(() => setNow(Date.now()));
    return () => {
      clearInterval(t);
      off();
    };
  }, [hidden]);
  return now;
}

type Ending = { key: string; done: boolean; work?: Work; list: CastEntry[] };

/**
 * the talk's casting: its entries now, and the end of one (the clock collapses into a burst — `done` — or fades: a
 * failure). `stage` lays the clock over the bowl for TalkScene (the talk ends above it); `rise`: the work done (for a
 * scene that has no rise of its own).
 */
export function useCastWait(msgs: Msg[], reduced: boolean) {
  const entries = useMemo(() => castEntries(msgs), [msgs]);
  const sig = entries.map((e) => e.id).join('|');
  // the entries before (kept in state, so an end is seen in the same render: no idle frame between the clock and its burst)
  const [track, setTrack] = useState<{ sig: string; list: CastEntry[] }>({ sig, list: entries });
  const [ending, setEnding] = useState<Ending | null>(null);
  let end = ending;
  if (track.sig !== sig) {
    const gone = track.list.filter((e) => !entries.some((x) => x.id === e.id));
    setTrack({ sig, list: entries });
    if (gone.length) {
      const work = msgs.flatMap((m) => (m.who === 'work' && m.work.id === gone[0].id ? [m.work] : []))[0];
      end = { key: `${gone[0].id}-${Date.now()}`, done: work?.status === 'ready', work, list: [gone[0], ...entries] };
      setEnding(end);
    }
  }
  useEffect(() => {
    if (!ending) return;
    const key = ending.key;
    const t = setTimeout(() => setEnding((x) => (x?.key === key ? null : x)), 1500);
    return () => clearTimeout(t);
  }, [ending]);
  const hidden = usePageHidden();
  const list = end ? end.list : entries;
  const active = list.length > 0;
  const stage = active
    ? (m: { w: number; h: number; top: number; at: (u: number, v: number) => { x: number; y: number }; scale: number }) => {
        const g = clockPlace(m);
        return { top: g.top, node: <CastClock key="cast-clock" list={list} ending={end} reduced={reduced} hidden={hidden} cx={g.cx} cy={g.cy} size={g.size} /> };
      }
    : undefined;
  const lead = entries[0] ?? end?.list[0];
  const rise = end?.done && end.work ? { key: end.key, image: end.work.image ?? end.work.poster ?? end.work.candidates?.[0]?.url, kind: end.work.kind } : null;
  return { active: entries.length > 0, showing: active, stage, palette: lead ? castPalette(lead.kind) : undefined, rise, hidden };
}

/** where the clock floats: over the bowl's far rim, as big as the sky there allows (the talk keeps a few lines above) */
export function clockPlace(m: { top: number; at: (u: number, v: number) => { x: number; y: number }; scale: number }) {
  const b = m.at(TEMPLE_PLATE.bowl.u, TEMPLE_PLATE.bowl.v);
  const bw = TEMPLE_PLATE.bowl.w * m.scale;
  const rim = b.y - bw * 0.16;
  const room = rim - (m.top + 150);
  const size = Math.round(Math.max(112, Math.min(270, bw * 0.86, room - 40)));
  const cy = rim - 18 - size / 2;
  return { cx: b.x, cy, size, top: Math.round(cy - size * 0.62 - 6) };
}

const CSS = `
@keyframes cc-spin{to{transform:rotate(360deg)}}
@keyframes cc-spin-r{to{transform:rotate(-360deg)}}
@keyframes cc-aura{0%,100%{opacity:.6;transform:scale(.94)}50%{opacity:1;transform:scale(1.06)}}
@keyframes cc-in{from{opacity:0;transform:scale(.6) rotate(-40deg)}to{opacity:1;transform:none}}
@keyframes cc-fade{from{opacity:0}to{opacity:1}}
@keyframes cc-twinkle{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1)}}
@keyframes cc-breathe{0%,100%{opacity:.78}50%{opacity:1}}
@keyframes cc-collapse{0%{opacity:1;transform:scale(1) rotate(0)}100%{opacity:0;transform:scale(.12) rotate(140deg)}}
@keyframes cc-flash{0%{opacity:0;transform:scale(.15)}25%{opacity:1}100%{opacity:0;transform:scale(2.1)}}
@keyframes cc-ray{0%{opacity:0;transform:rotate(var(--a)) scaleY(.1)}30%{opacity:1}100%{opacity:0;transform:rotate(var(--a)) scaleY(1)}}
@keyframes cc-gone{to{opacity:0;transform:scale(.85)}}
[data-cast-paused] *,[data-cast-paused]{animation-play-state:paused!important}
`;

/** twelve small marks for the rune ring (zodiac-like, alchemical; drawn, so no font is needed) */
const GLYPHS = [
  'M-3.6 3.6C-3.6-3.6 0-3.6 0 0C0-3.6 3.6-3.6 3.6 3.6',
  'M-3.6-3.6C-2.6-.6 2.6-.6 3.6-3.6M0 3.6a2.3 2.3 0 1 0 0-4.6a2.3 2.3 0 1 0 0 4.6',
  'M-3.6-3.6H3.6M-3.6 3.6H3.6M-1.6-3.6V3.6M1.6-3.6V3.6',
  'M2-3.6A4 4 0 1 0 2 3.6A3 3 0 1 1 2-3.6',
  'M0-3.8L3.6 3.2H-3.6ZM-2.4 .8H2.4',
  'M-3.8-3V3M-3.8-2C-3-3.8-1-3.8-1-2V3M-1-2C0-3.8 2-3.8 2-2V2.6L3.8 3.8',
  'M0-4L1 -1L4-1L1.6 1L2.6 4L0 2.2L-2.6 4L-1.6 1L-4-1L-1-1Z',
  'M0 3.8L3.6-3.2H-3.6Z',
  'M0 .6a3.2 3.2 0 1 0 0-.01M0-.2a.6.6 0 1 0 0 .01',
  'M0-1.2a2.4 2.4 0 1 0 0-.01M0 1.2V4.2M-1.6 2.8H1.6',
  'M-3.4 2.6A2 2 0 1 1 -1.2 0C-1.2-4 3.6-4 3-.4C2.6 2.4 3.2 3.4 3.8 3.4',
  'M-3.6 0H3.6M0-3.6V3.6M-2.5-2.5L2.5 2.5M2.5-2.5L-2.5 2.5',
];

/** a point on a circle (deg from the top, clockwise) */
const pt = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: +(r * Math.cos(a)).toFixed(2), y: +(r * Math.sin(a)).toFixed(2) };
};

/** one ring as its own layer (it turns on the compositor) */
function Layer({ children, spin, reduced, z }: { children: ReactNode; spin?: string; reduced: boolean; z?: number }) {
  return (
    <svg viewBox="-100 -100 200 200" className="absolute inset-0 h-full w-full overflow-visible will-change-transform" style={{ animation: spin && !reduced ? spin : undefined, zIndex: z }} aria-hidden>
      {children}
    </svg>
  );
}

function Astrolabe({ f, pal, reduced, look, kind, size }: { f: ClockFace; pal: CastPalette; reduced: boolean; look: TalismanLook; kind: AtelierKind; size: number }) {
  const dash = ringDash(f.fill, 93);
  const head = pt(93, f.fill * 360);
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const g = `rgba(${pal.glow},`;
  const big = size >= 160;
  return (
    <>
      {/* the glow it stands in */}
      <span className="absolute left-1/2 top-1/2 block rounded-full will-change-transform" style={{ width: '170%', height: '170%', marginLeft: '-85%', marginTop: '-85%', background: `radial-gradient(circle, ${g}.42) 0%, ${g}.16) 38%, ${g}0) 66%)`, mixBlendMode: 'screen', animation: reduced ? undefined : 'cc-aura 4.8s ease-in-out infinite' }} />
      {/* rays of light behind it, turning very slowly */}
      <span className="absolute left-1/2 top-1/2 block rounded-full will-change-transform" style={{ width: '210%', height: '210%', marginLeft: '-105%', marginTop: '-105%', background: `repeating-conic-gradient(from 0deg, ${g}.0) 0deg, ${g}.34) 3deg, ${g}.0) 7deg, ${g}0) 22.5deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 18%, rgba(0,0,0,.55) 34%, rgba(0,0,0,0) 62%)', maskImage: 'radial-gradient(circle, #000 18%, rgba(0,0,0,.55) 34%, rgba(0,0,0,0) 62%)', mixBlendMode: 'screen', animation: reduced ? undefined : 'cc-spin 160s linear infinite' }} />
      {/* a veil of night inside the rings (they read against the temple) */}
      <span className="absolute inset-0 block rounded-full" style={{ background: `radial-gradient(circle, ${pal.disc} 0%, ${pal.disc.replace(/[\d.]+\)$/, '.55)')} 45%, ${g}.12) 68%, ${g}0) 74%)` }} />
      {/* the outer ring: its track, the light filling it (elapsed / its time), the orb at its head */}
      <Layer reduced={reduced}>
        <circle r="95" fill="none" stroke={`${g}.22)`} strokeWidth="12" />
        <circle r="97" fill="none" stroke={pal.ring} strokeOpacity=".5" strokeWidth=".8" />
        <circle r="93" fill="none" stroke={pal.ring} strokeOpacity=".2" strokeWidth="3" />
        <circle r="89" fill="none" stroke={pal.ring} strokeOpacity=".3" strokeWidth=".6" />
        <g transform="rotate(-90)" style={{ animation: f.overdue && !reduced ? 'cc-breathe 2.6s ease-in-out infinite' : undefined }}>
          <circle r="93" fill="none" stroke={`${g}.35)`} strokeWidth="10" strokeLinecap="round" strokeDasharray={dash.dasharray} strokeDashoffset={dash.dashoffset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          <circle r="93" fill="none" stroke={pal.ring} strokeWidth="3.2" strokeLinecap="round" strokeDasharray={dash.dasharray} strokeDashoffset={dash.dashoffset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </g>
        {!f.overdue && f.fill > 0.01 && (
          <g style={{ transform: `translate(${head.x}px, ${head.y}px)`, transition: 'transform 1s linear' }}>
            <circle r="9" fill={`${g}.35)`} />
            <circle r="3.6" fill="#fff" />
          </g>
        )}
        {/* four cardinal studs */}
        {[0, 90, 180, 270].map((d) => {
          const p = pt(97, d);
          return <path key={d} d={`M${p.x} ${p.y - 3.4}L${p.x + 2.2} ${p.y}L${p.x} ${p.y + 3.4}L${p.x - 2.2} ${p.y}Z`} fill={pal.ring} transform={`rotate(${d} ${p.x} ${p.y})`} />;
        })}
      </Layer>
      {/* the rune ring, turning slowly */}
      <Layer reduced={reduced} spin="cc-spin 140s linear infinite">
        <circle r="84" fill="none" stroke={pal.ring} strokeOpacity=".55" strokeWidth=".7" />
        <circle r="71" fill="none" stroke={pal.ring} strokeOpacity=".55" strokeWidth=".7" />
        {GLYPHS.map((d, i) => {
          const p = pt(77.5, i * 30 + 15);
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${i * 30 + 15}) scale(1.15)`}>
              <path d={d} fill="none" stroke={`${g}.45)`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke={pal.ring} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const p = pt(77.5, i * 30);
          return <circle key={i} cx={p.x} cy={p.y} r="1.3" fill={pal.accent} />;
        })}
      </Layer>
      {/* the hour ticks, turning the other way */}
      <Layer reduced={reduced} spin="cc-spin-r 90s linear infinite">
        {ticks.map((i) => {
          const a = pt(66, i * 6);
          const b = pt(i % 5 ? 62.5 : 58, i * 6);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i % 5 ? pal.ring : pal.accent} strokeOpacity={i % 5 ? 0.45 : 0.95} strokeWidth={i % 5 ? 0.7 : 1.5} />;
        })}
      </Layer>
      {/* the star at its heart */}
      <Layer reduced={reduced} spin="cc-spin 48s linear infinite">
        <polygon points={[0, 90, 180, 270].map((d) => { const p = pt(54, d); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke={pal.accent} strokeOpacity=".5" strokeWidth=".8" />
        <polygon points={[45, 135, 225, 315].map((d) => { const p = pt(54, d); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke={pal.accent} strokeOpacity=".5" strokeWidth=".8" />
        <circle r="48" fill="none" stroke={pal.ring} strokeOpacity=".35" strokeWidth=".6" strokeDasharray="1 3" />
      </Layer>
      {/* the hand: a needle with a crescent, sweeping */}
      <Layer reduced={reduced} spin="cc-spin 9s linear infinite" z={2}>
        <g transform={reduced ? `rotate(${(f.fill * 360).toFixed(1)})` : undefined}>
          <path d="M0 14L0 -86" stroke={`${g}.4)`} strokeWidth="5" strokeLinecap="round" />
          <path d="M0 16L0 -86" stroke={pal.ring} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M0 -95A6 6 0 1 0 0 -83A4.6 4.6 0 1 1 0 -95Z" fill={pal.num} />
          <circle cy="20" r="3" fill="none" stroke={pal.ring} strokeWidth="1.2" />
        </g>
      </Layer>
      {/* the dark disc and its glowing numerals */}
      <span className="absolute left-1/2 top-1/2 z-[3] flex flex-col items-center justify-center rounded-full" style={{ width: '46%', height: '46%', marginLeft: '-23%', marginTop: '-23%', background: `radial-gradient(circle at 50% 42%, ${pal.disc} 0%, ${pal.disc} 62%, ${g}.25) 100%)`, boxShadow: `0 0 0 1px ${g}.65), 0 0 ${size * 0.08}px ${g}.55), inset 0 0 ${size * 0.06}px ${g}.45)` }}>
        {f.numerals ? (
          <span key={f.overdue ? 'over' : f.words ? 'words' : 'clock'} className="flex flex-col items-center leading-none" style={{ animation: 'cc-fade .9s ease-out both' }} data-testid="cast-numerals">
            {!f.words && <span style={{ fontSize: size * 0.055, color: pal.ring, letterSpacing: '.3em', marginBottom: size * 0.012, marginLeft: '.3em', opacity: 0.85 }}>あと</span>}
            <span
              style={{
                fontFamily: f.words ? face(look) : `${face(look)}`,
                fontSize: f.words ? size * (f.overdue ? 0.079 : 0.088) : size * 0.13,
                fontVariantNumeric: 'tabular-nums',
                color: pal.num,
                letterSpacing: f.words ? '.06em' : '.04em',
                textShadow: `0 0 ${size * 0.03}px ${g}1), 0 0 ${size * 0.08}px ${g}.8)`,
                whiteSpace: 'nowrap',
                animation: f.overdue && !reduced ? 'cc-breathe 2.6s ease-in-out infinite' : undefined,
              }}
            >
              {f.numerals}
            </span>
          </span>
        ) : (
          <span style={{ color: pal.num, filter: `drop-shadow(0 0 6px ${g}.9))`, width: size * 0.13, height: size * 0.13 }}>
            <KindMark kind={kind} className="h-full w-full" />
          </span>
        )}
        {f.numerals && big && (
          <span className="mt-1 block opacity-70" style={{ color: pal.ring, width: size * 0.06, height: size * 0.06 }}>
            <KindMark kind={kind} className="h-full w-full" />
          </span>
        )}
      </span>
      {/* glints around it */}
      {!reduced &&
        [
          [-0.58, -0.2, 0],
          [0.6, -0.35, 1.3],
          [0.5, 0.42, 2.4],
          [-0.46, 0.5, 0.7],
          [0.05, -0.66, 1.9],
        ].map(([x, y, d], k) => (
          <span key={k} className="absolute left-1/2 top-1/2 block rounded-full bg-white will-change-transform" style={{ left: `${50 + x * 100}%`, top: `${50 + y * 100}%`, width: 4, height: 4, marginLeft: -2, marginTop: -2, boxShadow: `0 0 8px 3px ${g}.9)`, animation: `cc-twinkle 3.2s ease-in-out ${d}s infinite`, opacity: 0 }} />
        ))}
    </>
  );
}

/** a small sigil for another work being made: its kind, its own thin ring */
function Sigil({ e, now, size }: { e: CastEntry; now: number; size: number }) {
  const pal = castPalette(e.kind);
  const f = clockFace(jobView(e.jobId), now, e.long);
  const dash = ringDash(f.fill, 42);
  const g = `rgba(${pal.glow},`;
  return (
    <span className="relative block" style={{ width: size, height: size }} data-testid="cast-sigil">
      <span className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${pal.disc} 0%, ${pal.disc} 55%, ${g}.3) 100%)`, boxShadow: `0 0 ${size * 0.35}px ${g}.55)` }} />
      <svg viewBox="-50 -50 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle r="42" fill="none" stroke={pal.ring} strokeOpacity=".25" strokeWidth="4" />
        <circle r="42" fill="none" stroke={pal.ring} strokeWidth="4.5" strokeLinecap="round" transform="rotate(-90)" strokeDasharray={dash.dasharray} strokeDashoffset={dash.dashoffset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        <circle r="48" fill="none" stroke={pal.ring} strokeOpacity=".4" strokeWidth="1" strokeDasharray="2 5" />
      </svg>
      <span className="absolute inset-[27%]" style={{ color: pal.num, filter: `drop-shadow(0 0 4px ${g}.9))` }}>
        <KindMark kind={e.kind} className="h-full w-full" />
      </span>
    </span>
  );
}

export function CastClock({ list, ending, reduced, hidden, cx, cy, size }: { list: CastEntry[]; ending: Ending | null; reduced: boolean; hidden: boolean; cx: number; cy: number; size: number }) {
  const now = useNow(hidden);
  const ordered = useMemo(() => {
    const xs = list.map((e) => ({ e, job: jobView(e.jobId) }));
    // the one finishing leads while it collapses; otherwise the soonest to finish
    return ending ? xs : clockOrder(xs, now);
  }, [list, ending, now]);
  const main = ordered[0]?.e;
  const look = spellLookFor(main?.kind ?? 'song');
  useSpellFont(look);
  if (!main) return null;
  const pal = castPalette(main.kind);
  const f = clockFace(ordered[0].job, now, main.long);
  const others = ordered.slice(1).map((x) => x.e);
  const shown = others.slice(0, 3);
  const more = others.length - shown.length;
  const sig = Math.round(size * 0.22);
  const orbit = size * 0.66;
  const g = `rgba(${pal.glow},`;
  return (
    <div className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate3d(${cx}px, ${cy}px, 0)` }} data-cast-clock={look} data-cast-state={ending ? (ending.done ? 'burst' : 'fade') : f.overdue ? 'overdue' : 'counting'} data-cast-paused={hidden ? '' : undefined} aria-label={f.numerals ? `つくっているよ　${f.numerals}` : 'つくっているよ'} role="timer">
      <style>{CSS}</style>
      <div
        key={main.id}
        className="absolute"
        style={{ left: -size / 2, top: -size / 2, width: size, height: size, animation: ending ? (ending.done && !reduced ? 'cc-collapse .55s cubic-bezier(.6,0,.8,.4) both' : 'cc-gone .8s ease-in both') : reduced ? 'cc-fade .8s ease-out both' : 'cc-in 1.1s cubic-bezier(.2,.8,.2,1) both' }}
      >
        <Astrolabe f={f} pal={pal} reduced={reduced} look={look} kind={main.kind} size={size} />
      </div>
      {/* the others, orbiting slowly (each kept upright) */}
      {!!shown.length && !ending && (
        <div className="absolute left-0 top-0 h-0 w-0 will-change-transform" style={{ animation: reduced ? undefined : 'cc-spin 60s linear infinite' }}>
          {shown.map((e, i) => {
            const deg = 236 + i * 46;
            const p = pt(orbit, deg);
            return (
              <span key={e.id} className="absolute block" style={{ left: p.x - sig / 2, top: p.y - sig / 2, animation: 'cc-fade .8s ease-out both' }}>
                <span className="block will-change-transform" style={{ animation: reduced ? undefined : 'cc-spin-r 60s linear infinite' }}>
                  <Sigil e={e} now={now} size={sig} />
                </span>
              </span>
            );
          })}
        </div>
      )}
      {more > 0 && !ending && (
        <span className="absolute whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] tracking-[0.12em]" style={{ left: size * 0.42, top: size * 0.36, color: pal.num, background: pal.disc, boxShadow: `0 0 0 1px ${g}.6), 0 0 10px ${g}.5)` }}>
          ほか{more}つ
        </span>
      )}
      {/* done: a burst of light where the clock was */}
      {ending?.done && (
        <>
          <span className="absolute block rounded-full will-change-transform" style={{ left: -size * 0.75, top: -size * 0.75, width: size * 1.5, height: size * 1.5, background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,.85) 12%, ${g}.75) 30%, ${g}.25) 50%, ${g}0) 68%)`, mixBlendMode: 'screen', animation: reduced ? 'cc-gone 1.4s ease-out both' : 'cc-flash 1.15s .22s cubic-bezier(.2,.7,.3,1) both', opacity: reduced ? 1 : 0 }} data-testid="cast-burst" />
          {!reduced &&
            [0, 0.16].map((d, k) => (
              <span key={`w${k}`} className="absolute block rounded-full will-change-transform" style={{ left: -size * 0.5, top: -size * 0.5, width: size, height: size, border: `${k ? 1.5 : 3}px solid ${pal.ring}`, boxShadow: `0 0 18px ${g}.95), inset 0 0 18px ${g}.95)`, animation: `cc-flash 1.05s ${0.3 + d}s ease-out both`, opacity: 0 }} />
            ))}
          {!reduced &&
            Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="absolute block will-change-transform"
                style={{ left: -2, top: -size * (i % 2 ? 0.8 : 1.15), width: i % 2 ? 2 : 4, height: size * (i % 2 ? 0.8 : 1.15), transformOrigin: '50% 100%', background: `linear-gradient(to top, rgba(255,255,255,0) 15%, #fff 55%, ${pal.ring} 75%, rgba(255,255,255,0))`, ['--a' as string]: `${i * 22.5 + 11}deg`, animation: `cc-ray .95s ${0.26 + (i % 4) * 0.03}s ease-out both`, opacity: 0 }}
              />
            ))}
        </>
      )}
    </div>
  );
}
