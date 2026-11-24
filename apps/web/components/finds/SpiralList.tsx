'use client';

import { MARK_GLYPH, type BluenaPlanet, type ItemMarkId, type MarkedKind } from '@obolo/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Glyph, type GlyphId } from '@/components/bluena/glyphs';
import { markNames, marksInUse, markOf, useMarks } from '@/lib/finds/marks';
import { armAt, dotOfRow, spiralDots, turnFor, type SpiralDot } from '@/lib/finds/spiral';
import { PLANET_COLOR, PLANET_GLYPH, PLANET_NAME } from '@/lib/finds/works';
import { MARK_COLOR, StarButton, useLongPress } from './MarkRing';

/** one row of the list (and one dot's worth of the spiral) */
export type SpiralRow = {
  id: string;
  at: string;
  /** the dot's colour (a planet's, a speaker's コロリン colour) */
  color: string;
  glyph?: GlyphId;
  thumb?: string | null;
  title: string;
  /** shown in place of the date (e.g. the day's speakers) */
  sub?: ReactNode;
  /** where its ★ / mark is kept; none = the row shows `stars` / `mark` as given (a day of talk) */
  mark?: { kind: MarkedKind; id: string };
  stars?: number;
  markId?: ItemMarkId | null;
};

export type FindFilter = { star?: boolean; mark?: ItemMarkId; planet?: BluenaPlanet; q?: string };

const BIG = 196;
const SMALL = 54;

/**
 * M-R237: the spiral and the list (Bluena's works, a thread's past talks). The spiral is a time map — the newest at
 * its outer end, the oldest at the centre; dragging along it jumps the list there, scrolling the list lights the place
 * on the spiral and turns it so that place is at the bottom, where the list goes on. Starting to scroll down shrinks
 * the spiral to the top corner; back at the top it opens again. Above the list: the filter strip (★, the marks in use,
 * the planets given) and a small search box.
 */
export function SpiralList({
  rows,
  filter,
  onFilter,
  planets,
  onRow,
  onRing,
  empty,
  search = '探す',
  dateOf = shortDate,
  noSpiral = false,
}: {
  /** R9 (client): the list alone, no galaxy above it (the talk's left drawer) */
  noSpiral?: boolean;
  rows: SpiralRow[] | null;
  filter: FindFilter;
  onFilter: (f: FindFilter) => void;
  /** planets to offer on the strip (none: no planet chips) */
  planets?: BluenaPlanet[];
  onRow: (row: SpiralRow, i: number) => void;
  onRing?: (row: SpiralRow, at: { x: number; y: number }) => void;
  empty: string;
  search?: string;
  dateOf?: (iso: string) => string;
}) {
  useMarks();
  const list = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState(0);
  const dots = useMemo(() => spiralDots((rows ?? []).map((r) => ({ id: r.id, at: r.at, color: r.color, glyph: r.glyph }))), [rows]);
  const activeDot = dotOfRow(dots, active);

  // the list scrolled: which row is at the top → its dot lights, the spiral turns; down a little → the spiral shrinks
  const frame = useRef(0);
  const scrubbing = useRef(false);
  const onScroll = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = list.current;
      if (!el) return;
      const top = el.scrollTop;
      setCompact((c) => (c ? top > 2 : top > 24));
      if (scrubbing.current) return;
      const kids = el.querySelectorAll<HTMLElement>('[data-row]');
      let i = 0;
      for (const k of kids) {
        if (k.offsetTop + k.offsetHeight > top + 6) break;
        i++;
      }
      setActive(Math.min(i, Math.max(0, (rows?.length ?? 1) - 1)));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    setActive(0);
    list.current?.scrollTo({ top: 0 });
  }, [rows]);

  const jump = (i: number) => {
    const el = list.current?.querySelector<HTMLElement>(`[data-row="${i}"]`);
    if (el && list.current) list.current.scrollTo({ top: Math.max(0, el.offsetTop - 2), behavior: 'smooth' });
    setActive(i);
  };

  const used = marksInUse();
  const names = markNames();
  const chip = (on: boolean) => `flex h-7 min-w-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 text-[13px] leading-none ${on ? 'border-sky-200/70 bg-sky-300/25 text-white' : 'border-white/12 bg-white/[0.04] text-white/70'}`;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* the spiral's place (it shrinks into the corner when the list is scrolled) */}
      {!noSpiral && <div className="shrink-0 transition-[height] duration-300 ease-out" style={{ height: compact ? 0 : BIG + 4 }} />}
      {!noSpiral && <div
        className="absolute z-[2] transition-all duration-300 ease-out"
        style={compact ? { top: 0, right: 0, width: SMALL, height: SMALL } : { top: 0, left: `calc(50% - ${BIG / 2}px)`, width: BIG, height: BIG }}
      >
        <Spiral
          dots={dots}
          active={activeDot}
          small={compact}
          onScrub={(k, done) => {
            scrubbing.current = !done;
            if (compact) {
              if (done) list.current?.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
            const d = dots[k];
            if (d) jump(d.first);
          }}
        />
      </div>}

      {/* the filter strip and the small search box */}
      <div className={`flex shrink-0 items-center gap-1.5 pb-2 transition-[padding] duration-300 ${compact && !noSpiral ? 'pr-[60px] pt-3' : 'pt-1'}`}>
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto" role="toolbar" aria-label="しぼりこみ">
          <button className={chip(!!filter.star)} aria-pressed={!!filter.star} aria-label="お気に入り" onClick={() => onFilter({ ...filter, star: !filter.star || undefined })}>
            <span className="text-amber-300">★</span>
          </button>
          {used.map((k) => (
            <button key={k} className={chip(filter.mark === k)} aria-pressed={filter.mark === k} aria-label={names[k] || MARK_GLYPH[k]} onClick={() => onFilter({ ...filter, mark: filter.mark === k ? undefined : k })}>
              <span style={{ color: MARK_COLOR[k] }}>{MARK_GLYPH[k]}</span>
            </button>
          ))}
          {(planets ?? []).map((p) => (
            <button key={p} className={chip(filter.planet === p)} aria-pressed={filter.planet === p} aria-label={PLANET_NAME[p]} onClick={() => onFilter({ ...filter, planet: filter.planet === p ? undefined : p })}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLANET_COLOR[p] }} />
              <Glyph id={PLANET_GLYPH[p]} label={false} className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <SearchBox value={filter.q ?? ''} placeholder={search} onChange={(q) => onFilter({ ...filter, q: q || undefined })} />
      </div>

      {/* the list goes on from the spiral's outer end, downward, newest first */}
      <div ref={list} onScroll={onScroll} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
        {rows === null && <p className="py-8 text-center text-xs text-white/45">…</p>}
        {rows?.length === 0 && <p className="py-8 text-center text-xs text-white/45">{empty}</p>}
        {!!rows?.length && <span aria-hidden className="pointer-events-none absolute bottom-0 left-[22px] top-0 w-px bg-gradient-to-b from-white/30 via-white/10 to-transparent" />}
        {rows?.map((r, i) => <Row key={r.id} r={r} i={i} on={i === active} date={dateOf(r.at)} onTap={() => onRow(r, i)} onRing={onRing ? (at) => onRing(r, at) : undefined} />)}
      </div>
    </div>
  );
}

function Row({ r, i, on, date, onTap, onRing }: { r: SpiralRow; i: number; on: boolean; date: string; onTap: () => void; onRing?: (at: { x: number; y: number }) => void }) {
  const lp = useLongPress((at) => onRing?.(at));
  const m = r.mark ? markOf(r.mark.kind, r.mark.id) : { stars: r.stars ?? 0, mark: r.markId ?? null };
  return (
    <div
      data-row={i}
      role="button"
      tabIndex={0}
      {...(onRing ? lp : {})}
      onClick={onTap}
      onKeyDown={(e) => e.key === 'Enter' && onTap()}
      className={`relative flex select-none items-center gap-2.5 rounded-2xl py-1.5 pl-0.5 pr-1.5 transition-colors ${on ? 'bg-white/[0.07]' : ''}`}
    >
      <span className="relative block h-11 w-11 shrink-0">
        {r.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.thumb} alt="" className="h-11 w-11 rounded-xl object-cover" style={{ boxShadow: `0 0 0 1.5px ${r.color}` }} />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${r.color}26`, boxShadow: `0 0 0 1.5px ${r.color}aa` }}>
            {r.glyph ? <Glyph id={r.glyph} label={false} className="h-5 w-5" style={{ color: r.color }} /> : <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />}
          </span>
        )}
        {/* the dot: the planet's colour and its mark */}
        {r.thumb && (
          <span className="absolute -bottom-1 -left-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ring-[#0b0f24]" style={{ background: r.color }}>
            {r.glyph && <Glyph id={r.glyph} label={false} className="h-3 w-3 text-[#0b0f24]" strokeWidth={2.2} />}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-snug text-white/90">{r.title || '　'}</span>
        <span className="block truncate text-[10.5px] text-white/45">{r.sub ?? date}</span>
      </span>
      {r.mark ? (
        <StarButton kind={r.mark.kind} id={r.mark.id} onRing={onRing} />
      ) : (
        (m.stars > 0 || m.mark) && (
          <span className="flex items-center gap-0.5 text-[12px]">
            {m.stars > 0 && <span className="tracking-[-0.12em] text-amber-300">{'★'.repeat(m.stars)}</span>}
            {m.mark && <span style={{ color: MARK_COLOR[m.mark] }}>{MARK_GLYPH[m.mark]}</span>}
          </span>
        )
      )}
    </div>
  );
}

function SearchBox({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (q: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  // the list follows the words a moment after typing stops
  useEffect(() => {
    if (v === value) return;
    const t = setTimeout(() => onChange(v.trim()), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <label className="flex h-7 w-[92px] shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2 text-white/60 focus-within:w-[130px] focus-within:border-sky-200/50">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" strokeLinecap="round" />
      </svg>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/35" />
    </label>
  );
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (d.getTime() <= 0) return '';
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * The galaxy (SVG, ≤ ~30 dots: light on phones). Each dot: its colour and a small mark (not the colour alone); the outer
 * and bigger, the newer. The lit one is turned to the bottom, smoothly.
 */
export function Spiral({ dots, active, small, onScrub }: { dots: SpiralDot[]; active: number; small: boolean; onScrub: (k: number, done: boolean) => void }) {
  const R = 86;
  const target = dots[active] ? turnFor(dots[active].t) : turnFor(1);
  const [rot, setRot] = useState(target);
  const held = useRef(false);
  // turn toward the lit dot (not while the finger is on the spiral: the dots must stay under it)
  useEffect(() => {
    if (held.current) return;
    let raf = 0;
    let cur = rot;
    // the short way round
    let goal = target;
    while (goal - cur > Math.PI) goal -= Math.PI * 2;
    while (cur - goal > Math.PI) goal += Math.PI * 2;
    const step = () => {
      cur += (goal - cur) * 0.16;
      if (Math.abs(goal - cur) < 0.002) cur = goal;
      setRot(cur);
      if (cur !== goal) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const pos = (t: number) => {
    const { a, r } = armAt(t);
    return { x: Math.cos(a + rot) * r * R, y: Math.sin(a + rot) * r * R };
  };
  const arm = (off: number, to = 1) => {
    let d = '';
    for (let k = 0; k <= 60; k++) {
      const t = (k / 60) * to;
      const { a, r } = armAt(t);
      d += `${k ? 'L' : 'M'}${(Math.cos(a + rot + off) * r * R).toFixed(1)} ${(Math.sin(a + rot + off) * r * R).toFixed(1)}`;
    }
    return d;
  };

  const svg = useRef<SVGSVGElement>(null);
  const nearest = (e: React.PointerEvent) => {
    const b = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 200 - 100;
    const y = ((e.clientY - b.top) / b.height) * 200 - 100;
    let best = 0;
    let bd = Infinity;
    dots.forEach((d, k) => {
      const p = pos(d.t);
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd < bd) {
        bd = dd;
        best = k;
      }
    });
    return best;
  };
  const lit = dots[active];
  const lp = lit ? pos(lit.t) : null;

  return (
    <svg
      ref={svg}
      viewBox="-100 -100 200 200"
      className={`h-full w-full touch-none select-none ${small ? 'cursor-pointer' : ''}`}
      role="slider"
      aria-label="時間の地図"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, dots.length - 1)}
      aria-valuenow={active}
      onPointerDown={(e) => {
        if (!dots.length) return;
        held.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        if (!small) onScrub(nearest(e), false);
      }}
      onPointerMove={(e) => held.current && !small && onScrub(nearest(e), false)}
      onPointerUp={(e) => {
        if (!held.current) return;
        held.current = false;
        onScrub(small ? 0 : nearest(e), true);
        setRot((r) => r + 1e-6);
      }}
      onPointerCancel={() => (held.current = false)}
    >
      <defs>
        <radialGradient id="spiral-core">
          <stop offset="0%" stopColor="rgba(255,240,210,0.55)" />
          <stop offset="35%" stopColor="rgba(150,170,255,0.16)" />
          <stop offset="100%" stopColor="rgba(80,110,255,0)" />
        </radialGradient>
      </defs>
      <circle r={98} fill={small ? 'rgba(11,15,36,0.92)' : 'none'} stroke={small ? 'rgba(160,200,255,0.35)' : 'none'} strokeWidth={small ? 3 : 0} />
      <circle r={small ? 60 : 70} fill="url(#spiral-core)" />
      <path d={arm(0)} stroke="rgba(170,200,255,0.28)" strokeWidth={small ? 4 : 1.4} fill="none" strokeLinecap="round" />
      <path d={arm(Math.PI, 0.82)} stroke="rgba(170,200,255,0.12)" strokeWidth={small ? 3 : 1} fill="none" strokeDasharray={small ? undefined : '1 4'} />
      {/* the list goes on from the bottom */}
      {!small && lp && <line x1={lp.x} y1={lp.y} x2={lp.x} y2={100} stroke="rgba(255,255,255,0.22)" strokeWidth={0.8} strokeDasharray="2 3" />}
      {dots.map((d, k) => {
        const p = pos(d.t);
        const r = (small ? 4 : 2.6) + d.t * (small ? 6 : 6.4);
        const on = k === active;
        return (
          <g key={d.key} opacity={on ? 1 : 0.55 + d.t * 0.45}>
            {on && <circle cx={p.x} cy={p.y} r={r + 4.5} fill="none" stroke="#fff" strokeWidth={1.4} className="motion-safe:animate-pulse" />}
            {d.count > 1 && <circle cx={p.x} cy={p.y} r={r + 1.8} fill="none" stroke={d.color} strokeWidth={0.7} />}
            <circle cx={p.x} cy={p.y} r={r} fill={d.color} stroke="#0b0f24" strokeWidth={0.8} />
            {d.glyph && r >= 5 && !small && <Glyph id={d.glyph as GlyphId} label={false} x={p.x - r * 0.62} y={p.y - r * 0.62} width={r * 1.24} height={r * 1.24} color="#0b0f24" strokeWidth={2.4} />}
          </g>
        );
      })}
    </svg>
  );
}
