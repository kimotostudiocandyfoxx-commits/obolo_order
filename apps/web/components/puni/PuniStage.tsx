'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { anchors, BackParts, COLORS, FaceParts, FrontParts, SAMPLE_LOOKS, SkinDefs, SkinGloss, SkinRim, skinStroke, SLOT_LABELS, SLOTS, TextureDefs, WearPart, type Effect, type Look } from '@/lib/puni/parts';
import { createBlob, localPoints, poke, smoothPath, step, stretchMatrix, type Blob } from '@/lib/puni/physics';

/**
 * ぷにぷに prototype (client request 2026-10-07): the five reference characters redrawn in code
 * as soft round bodies. Tap = poke (dent, jiggle, >_< face, effect), drag = stretch and throw,
 * they roll, bounce, squash on the floor and against each other, and stand back up.
 * 着せ替え swaps parts on a body to show that every part fits every body.
 */
interface Nodes {
  outer: SVGGElement | null;
  rot: SVGGElement | null;
  gloss: SVGGElement | null;
  bodies: SVGPathElement[];
  clip: SVGPathElement | null;
  parts: SVGGElement[];
  open: SVGGElement | null;
  poked: SVGGElement | null;
}

interface Fx {
  id: number;
  kind: Effect;
  x: number;
  y: number;
}

export function PuniStage() {
  const [looks, setLooks] = useState<Look[]>(SAMPLE_LOOKS);
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [fx, setFx] = useState<Fx[]>([]);
  const [wardrobe, setWardrobe] = useState(false);
  const [pick, setPick] = useState(SAMPLE_LOOKS[0].id);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const blobs = useRef<Blob[]>([]);
  const nodes = useRef(new Map<string, Nodes>());
  const R = Math.max(40, Math.min(86, Math.min(size.W * 0.13, size.H * 0.1)));
  const floor = size.H - (wardrobe ? Math.min(330, size.H * 0.42) : Math.max(80, size.H * 0.1));
  const looksRef = useRef(looks);
  looksRef.current = looks;

  // size
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // blobs follow the looks (shape) and the size
  useEffect(() => {
    if (!size.W) return;
    const prev = new Map(blobs.current.map((b) => [b.id, b]));
    blobs.current = looks.map((l, i) => {
      const b = prev.get(l.id) ?? createBlob(l.id, (size.W / (looks.length + 1)) * (i + 1), 60 + i * 30, R, l.shape);
      b.shape = l.shape;
      b.R = R;
      return b;
    });
  }, [looks, size.W, R]);

  // the loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let blinkAt = performance.now() + 2000;
    let blinkId = '';
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const world = { W: size.W, H: size.H, floor };
      for (let k = 0; k < 2; k++) step(blobs.current, dt / 2, world);
      if (now > blinkAt) {
        blinkId = blobs.current[Math.floor(Math.random() * blobs.current.length)]?.id ?? '';
        blinkAt = now + 900 + Math.random() * 2200;
      }
      const blinking = now > blinkAt - 1000 && now < blinkAt - 860;
      for (const b of blobs.current) {
        const n = nodes.current.get(b.id);
        if (!n?.outer || !n.rot) continue;
        const [ma, mb, mc, md] = stretchMatrix(b);
        n.outer.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) matrix(${ma.toFixed(3)} ${mb.toFixed(3)} ${mc.toFixed(3)} ${md.toFixed(3)} 0 0)`);
        const deg = (b.angle * 180) / Math.PI;
        n.rot.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
        // the highlight stays top-left while the body rolls
        n.gloss?.setAttribute('transform', `rotate(${(-deg).toFixed(1)}) translate(0 ${(b.cy * 0.5).toFixed(1)}) scale(${b.sx.toFixed(3)} ${b.sy.toFixed(3)})`);
        const d = smoothPath(localPoints(b));
        for (const p of n.bodies) p.setAttribute('d', d);
        n.clip?.setAttribute('d', d);
        // the face lags a little behind the motion (jelly)
        const lagX = Math.max(-7, Math.min(7, -b.vx * 0.004));
        const lagY = Math.max(-7, Math.min(7, -b.vy * 0.004));
        const t = `translate(${lagX.toFixed(1)} ${(b.cy + lagY).toFixed(1)}) scale(${b.sx.toFixed(3)} ${b.sy.toFixed(3)}) scale(${(b.R / 100).toFixed(3)})`;
        for (const g of n.parts) g.setAttribute('transform', t);
        const poked = b.poked > 0 || !!b.drag;
        if (n.open) {
          n.open.style.display = poked ? 'none' : '';
          n.open.style.transform = blinking && b.id === blinkId ? 'scaleY(0.12)' : '';
        }
        if (n.poked) n.poked.style.display = poked ? '' : 'none';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size.W, size.H, floor]);

  // --- touch ------------------------------------------------------------------------------------

  const pointer = useRef<{ id: number; blob: Blob | null; x0: number; y0: number; moved: boolean; hist: { x: number; y: number; t: number }[] } | null>(null);
  const toLocal = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hit = (x: number, y: number) => {
    for (let i = blobs.current.length - 1; i >= 0; i--) {
      const b = blobs.current[i];
      if (Math.hypot(x - b.x, y - b.y) < b.R * 1.1) return b;
    }
    return null;
  };
  const addFx = useCallback((kind: Effect, x: number, y: number) => {
    const id = Math.random();
    setFx((f) => [...f.slice(-12), { id, kind, x, y }]);
    setTimeout(() => setFx((f) => f.filter((e) => e.id !== id)), 1000);
  }, []);

  const down = (e: React.PointerEvent) => {
    const p = toLocal(e);
    const b = hit(p.x, p.y);
    svg.current?.setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, blob: b, x0: p.x, y0: p.y, moved: false, hist: [{ ...p, t: performance.now() }] };
    if (b) setPick(b.id);
  };
  const move = (e: React.PointerEvent) => {
    const pt = pointer.current;
    if (!pt || pt.id !== e.pointerId || !pt.blob) return;
    const p = toLocal(e);
    pt.hist.push({ ...p, t: performance.now() });
    if (pt.hist.length > 6) pt.hist.shift();
    if (!pt.moved && Math.hypot(p.x - pt.x0, p.y - pt.y0) > 8) pt.moved = true;
    if (pt.moved) pt.blob.drag = { tx: p.x, ty: p.y };
  };
  const up = (e: React.PointerEvent) => {
    const pt = pointer.current;
    pointer.current = null;
    if (!pt || pt.id !== e.pointerId) return;
    const b = pt.blob;
    if (!b) {
      // tapping the empty floor makes everyone hop
      for (const x of blobs.current) if (x.grounded) x.vy -= 500;
      return;
    }
    if (pt.moved) {
      b.drag = null;
      const h = pt.hist;
      const a = h[0];
      const z = h[h.length - 1];
      const dt = Math.max(0.016, (z.t - a.t) / 1000);
      b.vx = Math.max(-2600, Math.min(2600, (z.x - a.x) / dt));
      b.vy = Math.max(-2600, Math.min(2600, (z.y - a.y) / dt));
      b.av = b.vx / b.R / 2;
    } else {
      const p = toLocal(e);
      poke(b, p.x, p.y);
      const look = looksRef.current.find((l) => l.id === b.id);
      if (look) addFx(look.effect, b.x, b.y - b.R);
    }
  };

  const scatter = () => {
    for (const b of blobs.current) {
      b.vy = -900 - Math.random() * 600;
      b.vx = (Math.random() - 0.5) * 1400;
      b.av = (Math.random() - 0.5) * 10;
    }
  };

  const picked = looks.find((l) => l.id === pick) ?? looks[0];
  const setSlot = (k: keyof Look, v: string) => setLooks((ls) => ls.map((l) => (l.id === picked.id ? { ...l, [k]: v } : l)));

  return (
    <div ref={box} className="relative h-full w-full touch-none select-none overflow-hidden" style={{ fontFamily: '"Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#2b1b5c] via-[#6b3fa3] to-[#f4a3c4]" />
      <div className="starfield" aria-hidden />
      {/* floor: the striped planet surface */}
      <div
        className="pointer-events-none absolute inset-x-[-20%] rounded-t-[50%]"
        style={{ top: floor - 6, bottom: -40, background: 'repeating-linear-gradient(180deg, #ffd8c2 0 14px, #ffc0b0 14px 28px, #f7a8b8 28px 42px, #ffdcc8 42px 56px)', boxShadow: '0 -14px 40px rgba(255,200,220,.45)' }}
      />

      {size.W > 0 && (
        <svg ref={svg} width={size.W} height={size.H} className="absolute inset-0" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <defs>
            <filter id="puni-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="puni-shine" cx="35%" cy="28%" r="70%">
              <stop offset="0" stopColor="#fff" stopOpacity=".55" />
              <stop offset=".45" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".18" />
            </radialGradient>
          </defs>
          {looks.map((l) => (
            <Character key={l.id} look={l} R={R} register={(n) => nodes.current.set(l.id, n)} />
          ))}
        </svg>
      )}

      {/* poke effects */}
      {fx.map((f) => (
        <FxView key={f.id} fx={f} />
      ))}

      {/* header */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 px-4 text-center">
        <p className="mt-10 text-lg font-black text-white drop-shadow">ぷにぷに試作</p>
        <p className="text-[11px] font-bold text-white/80">タップ：つつく ／ ドラッグ：伸ばして投げる ／ 床をタップ：みんなジャンプ</p>
      </div>
      <div className="pb-safe absolute bottom-3 right-3 z-20 flex gap-2">
        <button onClick={scatter} className="rounded-full bg-white/90 px-4 py-2 text-xs font-black text-violet-600 shadow">
          🎉 ばらまく
        </button>
        <button onClick={() => setWardrobe((w) => !w)} className="rounded-full bg-gradient-to-r from-pink-400 to-violet-400 px-4 py-2 text-xs font-black text-white shadow">
          👕 着せ替え{wardrobe ? 'を閉じる' : ''}
        </button>
      </div>

      {wardrobe && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-10 overflow-y-auto rounded-t-3xl bg-white/95 px-4 pb-16 pt-3 text-slate-700 shadow-2xl" style={{ height: size.H - floor }}>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {looks.map((l) => (
              <button key={l.id} onClick={() => setPick(l.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${l.id === picked.id ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600'}`}>
                {l.name}
              </button>
            ))}
          </div>
          <Row label="色">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setSlot('color', c)} className={`h-7 w-7 shrink-0 rounded-full border-2 ${picked.color === c ? 'border-violet-500' : 'border-white'}`} style={{ background: c }} aria-label={c} />
            ))}
          </Row>
          {(Object.keys(SLOTS) as (keyof typeof SLOTS)[]).map((k) => (
            <Row key={k} label={SLOT_LABELS[k]}>
              {SLOTS[k].map(([v, label]) => (
                <button key={v} onClick={() => setSlot(k, v)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${picked[k] === v ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600'}`}>
                  {label}
                </button>
              ))}
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] font-black text-violet-400">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto py-0.5">{children}</div>
    </div>
  );
}

/** One character: the body path (colour, texture, shine, outline) with its parts. */
function Character({ look: l, R, register }: { look: Look; R: number; register: (n: Nodes) => void }) {
  const a = anchors(l.shape);
  const tex = `tex-${l.id}`;
  const clip = `clip-${l.id}`;
  const n = useRef<Nodes>({ outer: null, rot: null, gloss: null, bodies: [], clip: null, parts: [], open: null, poked: null });
  const partsRef = (el: SVGGElement | null) => {
    if (el && !n.current.parts.includes(el)) n.current.parts.push(el);
  };
  const bodyRef = (el: SVGPathElement | null) => {
    if (el && !n.current.bodies.includes(el)) n.current.bodies.push(el);
  };
  useEffect(() => {
    // pick up the face's two eye groups (open / poked) after each render
    const rot = n.current.rot;
    n.current.open = rot?.querySelector('[data-eyes="open"]') ?? null;
    n.current.poked = rot?.querySelector('[data-eyes="poked"]') ?? null;
    n.current.parts = n.current.parts.filter((g) => g.isConnected);
    n.current.bodies = n.current.bodies.filter((p) => p.isConnected);
    register(n.current);
  });
  return (
    <g ref={(el) => void (n.current.outer = el)}>
      <g ref={(el) => void (n.current.rot = el)}>
        <defs>
          <TextureDefs id={tex} tex={l.tex} color={l.color} R={R} />
          <SkinDefs uid={l.id} color={l.color} R={R} />
          <clipPath id={clip}>
            <path ref={(el) => void (n.current.clip = el)} />
          </clipPath>
        </defs>
        <g ref={partsRef}>
          <BackParts look={l} a={a} />
        </g>
        <path ref={bodyRef} fill={`url(#pg${l.id})`} />
        {l.tex !== 'none' && <path ref={bodyRef} fill={`url(#${tex})`} opacity={l.tex === 'rice' ? 0.95 : 0.85} />}
        <g clipPath={`url(#${clip})`}>
          <g ref={partsRef}>
            <WearPart look={l} a={a} />
          </g>
        </g>
        <SkinRim uid={l.id} clip={clip} color={l.color} R={R} />
        <g ref={(el) => void (n.current.gloss = el)}>
          <SkinGloss uid={l.id} R={R} />
        </g>
        <path ref={bodyRef} fill="none" stroke={skinStroke(l.color)} strokeOpacity={0.35} strokeWidth={1.5} />
        <g ref={partsRef}>
          <FaceParts look={l} a={a} />
          <FrontParts look={l} a={a} />
        </g>
      </g>
    </g>
  );
}

function FxView({ fx }: { fx: Fx }) {
  const base = 'pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2';
  if (fx.kind === 'puff')
    return (
      <div className={base} style={{ left: fx.x - 50, top: fx.y + 90 }}>
        <div className="animate-[puniPuff_1s_ease-out_forwards] text-5xl">
          <span style={{ filter: 'hue-rotate(160deg) saturate(2)' }}>💨</span>
        </div>
      </div>
    );
  const glyph = fx.kind === 'zap' ? '⚡' : fx.kind === 'hearts' ? '💗' : '✨';
  return (
    <div className={base} style={{ left: fx.x, top: fx.y }}>
      {[-1, 0, 1].map((k) => (
        <span key={k} className="absolute animate-[puniPop_0.9s_ease-out_forwards] text-2xl" style={{ ['--dx' as string]: `${k * 34}px`, animationDelay: `${(k + 1) * 60}ms` }}>
          {glyph}
        </span>
      ))}
    </div>
  );
}
