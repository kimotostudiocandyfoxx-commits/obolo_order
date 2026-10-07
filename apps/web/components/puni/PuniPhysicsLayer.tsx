'use client';

import type { PuniLook } from '@obolo/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createBlob, localPoints, poke, smoothPath, step, stretchMatrix, type Blob } from '@/lib/puni/physics';
import { makeRenderer } from '@/lib/puni/gl';
import { PuniBody, type PuniNodes } from './PuniBody';

/**
 * ぷにぷに characters living on a ground (Saturn, client request 2026-10-07): soft bodies that
 * fall onto the planet, squash, roll and bump into each other. Tap one → it squishes and
 * `onTap` fires (the world opens the post and plays its voice); drag → stretch and throw.
 * While a voice plays (`speakingId`) that character keeps jiggling as if talking.
 */
export interface PuniItem {
  id: string;
  look: PuniLook;
  /** body radius in px */
  R: number;
  /** a painted picture (round, transparent PNG): drawn warped onto the body instead of `look` */
  pic?: string | null;
  /** a photo posted with the voice: a small round picture at the character's lower right */
  photo?: string | null;
}

export interface PuniLayerHandle {
  /** everyone jumps / scatters a little */
  shake(): void;
  /** poke one (おまかせ) */
  poke(id: string): void;
  blob(id: string): Blob | undefined;
}

export const PuniPhysicsLayer = forwardRef<
  PuniLayerHandle,
  {
    items: PuniItem[];
    /** the ground's y at x for a stage of W×H */
    floorAt: (x: number, W: number, H: number) => number;
    onTap: (id: string) => void;
    onTapEmpty?: () => void;
    /** called every frame after the physics step (e.g. to move a card with a character) */
    onFrame?: (get: (id: string) => Blob | undefined, W: number, H: number) => void;
    speakingId?: string | null;
    /**
     * なぞる mode (みんな's ひろば, client decision 2026-10-07): sliding a finger over the characters
     * picks them one after another (like a chain puzzle) instead of dragging / throwing one.
     * Each newly touched one squishes and is reported to `onTrace` (a tap is a chain of one).
     */
    onTrace?: (id: string) => void;
    /** the finger lifted after tracing (a real tap for iPad Safari: sound may start here) */
    onTraceEnd?: () => void;
    className?: string;
  }
>(function PuniPhysicsLayer({ items, floorAt, onTap, onTapEmpty, onFrame, speakingId = null, onTrace, onTraceEnd, className = '' }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const pics = useRef(new Map<string, HTMLImageElement>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [size, setSize] = useState({ W: 0, H: 0 });
  const blobs = useRef<Blob[]>([]);
  const nodes = useRef(new Map<string, PuniNodes>());
  const held = useRef(new Map<string, HTMLDivElement>());
  const cb = useRef({ floorAt, onTap, onTapEmpty, onFrame, speakingId, onTrace, onTraceEnd });
  cb.current = { floorAt, onTap, onTapEmpty, onFrame, speakingId, onTrace, onTraceEnd };
  // the chain being traced (ids) and the glowing line through them
  const chain = useRef<string[]>([]);
  const chainLine = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // blobs follow the items: new ones drop in from the sky, gone ones leave
  useEffect(() => {
    if (!size.W) return;
    const prev = new Map(blobs.current.map((b) => [b.id, b]));
    blobs.current = items.map((it, i) => {
      const old = prev.get(it.id);
      if (old) {
        old.R = it.R;
        old.shape = it.look.shape;
        return old;
      }
      const x = size.W * (0.08 + ((i * 0.618) % 1) * 0.84);
      const b = createBlob(it.id, x, -it.R * 2 - (i % 6) * it.R * 1.6, it.R, it.look.shape);
      b.vx = (Math.random() - 0.5) * 120;
      return b;
    });
  }, [items, size.W]);

  useImperativeHandle(ref, () => ({
    shake() {
      for (const b of blobs.current) {
        b.vy = -700 - Math.random() * 500;
        b.vx = (Math.random() - 0.5) * 900;
        b.av = (Math.random() - 0.5) * 8;
      }
    },
    poke(id) {
      const b = blobs.current.find((x) => x.id === id);
      if (b) poke(b, b.x + (Math.random() - 0.5) * b.R, b.y - b.R * 0.6);
    },
    blob: (id) => blobs.current.find((x) => x.id === id),
  }));

  // load the painted pictures (once per url)
  useEffect(() => {
    for (const it of items) {
      if (!it.pic || pics.current.has(it.pic)) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = it.pic;
      pics.current.set(it.pic, img);
    }
  }, [items]);

  // the loop
  useEffect(() => {
    if (!size.W) return;
    const cv = glCanvas.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv) {
      cv.width = size.W * dpr;
      cv.height = size.H * dpr;
    }
    const gl = cv ? makeRenderer(cv) : null;
    let raf = 0;
    let last = performance.now();
    let blinkAt = last + 2000;
    let blinkId = '';
    let talk = 0;
    const { W, H } = size;
    const world = { W, H, floor: H, floorAt: (x: number) => cb.current.floorAt(x, W, H) };
    const get = (id: string) => blobs.current.find((b) => b.id === id);
    const resting = new Map<string, number>();
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      // the speaking one wobbles like a mouth moving
      const sp = cb.current.speakingId ? get(cb.current.speakingId) : undefined;
      talk += dt;
      if (sp && talk > 0.16) {
        talk = 0;
        for (let i = 0; i < sp.ov.length; i++) sp.ov[i] += (Math.random() - 0.3) * 160;
      }
      for (let k = 0; k < 2; k++) step(blobs.current, dt / 2, world);
      if (now > blinkAt) {
        blinkId = blobs.current[Math.floor(Math.random() * blobs.current.length)]?.id ?? '';
        blinkAt = now + 700 + Math.random() * 1800;
      }
      const blinking = now > blinkAt - 900 && now < blinkAt - 760;
      for (const b of blobs.current) {
        const n = nodes.current.get(b.id);
        if (!n?.outer || !n.rot) continue;
        // a character at rest is not redrawn (a pile of 30–50 stays light); anything that moves,
        // talks, blinks or is touched wakes it
        let wobble = 0;
        for (let i = 0; i < b.ov.length; i++) wobble = Math.max(wobble, Math.abs(b.ov[i]));
        const still = Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.av) * b.R < 4 && wobble < 6 && !b.poked && !b.drag && b !== sp && b.id !== blinkId;
        const idle = (resting.get(b.id) ?? 0) + 1;
        resting.set(b.id, still ? idle : 0);
        if (still && idle > 20) continue;
        const [ma, mb, mc, md] = stretchMatrix(b);
        n.outer.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) matrix(${ma.toFixed(3)} ${mb.toFixed(3)} ${mc.toFixed(3)} ${md.toFixed(3)} 0 0)`);
        const deg = (b.angle * 180) / Math.PI;
        n.rot.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
        n.gloss?.setAttribute('transform', `rotate(${(-deg).toFixed(1)}) translate(0 ${(b.cy * 0.5).toFixed(1)}) scale(${b.sx.toFixed(3)} ${b.sy.toFixed(3)})`);
        const d = smoothPath(localPoints(b));
        for (const p of n.bodies) p.setAttribute('d', d);
        n.clip?.setAttribute('d', d);
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
      // painted characters: WebGL mesh over the code-drawn ones
      if (gl) {
        gl.frame(W, H);
        for (const it of itemsRef.current) {
          if (!it.pic) continue;
          const b = get(it.id);
          const img = pics.current.get(it.pic);
          const t = b && img && gl.texture(it.pic, img);
          if (b && t) gl.draw(b, t);
        }
      }
      // photos: a small round picture at the lower right, sticking out of the body a little
      // (the face stays visible), squashing with it and swaying a little when moving
      for (const [id, el] of held.current) {
        const b = get(id);
        if (!b) continue;
        const d = b.R * 0.68;
        const tilt = 8 + Math.max(-12, Math.min(12, b.vx * 0.02));
        el.style.width = el.style.height = `${d.toFixed(0)}px`;
        el.style.transform = `translate(${(b.x + b.R * 0.66 * b.sx - d / 2).toFixed(1)}px, ${(b.y + b.cy + b.R * 0.5 * b.sy - d / 2).toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scale(${b.sx.toFixed(3)}, ${b.sy.toFixed(3)})`;
      }
      if (chainLine.current) {
        const pts = chain.current.map(get).filter((b): b is Blob => !!b);
        chainLine.current.setAttribute('points', pts.map((b) => `${b.x.toFixed(1)},${b.y.toFixed(1)}`).join(' '));
      }
      cb.current.onFrame?.(get, W, H);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  // --- touch ------------------------------------------------------------------------------------

  const pointer = useRef<{ id: number; blob: Blob | null; x0: number; y0: number; moved: boolean; hist: { x: number; y: number; t: number }[] } | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hit = (x: number, y: number) => {
    // front-most first (drawn last), a little generous for small fingers
    for (let i = blobs.current.length - 1; i >= 0; i--) {
      const b = blobs.current[i];
      if (Math.hypot(x - b.x, y - b.y) < b.R * 1.15) return b;
    }
    return null;
  };
  const traceAt = (x: number, y: number) => {
    const b = hit(x, y);
    if (!b || chain.current.includes(b.id)) return;
    chain.current.push(b.id);
    poke(b, x, y);
    cb.current.onTrace?.(b.id);
  };
  const down = (e: React.PointerEvent) => {
    const p = local(e);
    if (cb.current.onTrace) {
      svg.current?.setPointerCapture(e.pointerId);
      chain.current = [];
      pointer.current = { id: e.pointerId, blob: null, x0: p.x, y0: p.y, moved: false, hist: [] };
      traceAt(p.x, p.y);
      return;
    }
    const b = hit(p.x, p.y);
    if (b) svg.current?.setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, blob: b, x0: p.x, y0: p.y, moved: false, hist: [{ ...p, t: performance.now() }] };
  };
  const move = (e: React.PointerEvent) => {
    const pt = pointer.current;
    if (!pt || pt.id !== e.pointerId) return;
    const p = local(e);
    if (cb.current.onTrace) {
      if (Math.hypot(p.x - pt.x0, p.y - pt.y0) > 8) pt.moved = true;
      traceAt(p.x, p.y);
      return;
    }
    if (!pt.blob) {
      if (Math.hypot(p.x - pt.x0, p.y - pt.y0) > 8) pt.moved = true;
      return;
    }
    pt.hist.push({ ...p, t: performance.now() });
    if (pt.hist.length > 6) pt.hist.shift();
    if (!pt.moved && Math.hypot(p.x - pt.x0, p.y - pt.y0) > 8) pt.moved = true;
    if (pt.moved) pt.blob.drag = { tx: p.x, ty: p.y };
  };
  const up = (e: React.PointerEvent) => {
    const pt = pointer.current;
    pointer.current = null;
    if (!pt || pt.id !== e.pointerId) return;
    if (cb.current.onTrace) {
      if (!chain.current.length && !pt.moved) cb.current.onTapEmpty?.();
      else if (chain.current.length) cb.current.onTraceEnd?.();
      chain.current = [];
      return;
    }
    const b = pt.blob;
    if (!b) {
      // a tap on the sky / ground (not a character) closes the open card
      if (!pt.moved) cb.current.onTapEmpty?.();
      return;
    }
    if (pt.moved) {
      b.drag = null;
      const h = pt.hist;
      const a = h[0];
      const z = h[h.length - 1];
      const dt = Math.max(0.016, (z.t - a.t) / 1000);
      b.vx = Math.max(-2400, Math.min(2400, (z.x - a.x) / dt));
      b.vy = Math.max(-2400, Math.min(2400, (z.y - a.y) / dt));
      b.av = b.vx / b.R / 2;
    } else {
      const p = local(e);
      poke(b, p.x, p.y);
      cb.current.onTap(b.id);
    }
  };

  return (
    <div ref={box} className={`absolute inset-0 ${className}`}>
      {size.W > 0 && (
        <svg
          ref={svg}
          width={size.W}
          height={size.H}
          className="absolute inset-0 touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <defs>
            <filter id="puni-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <polyline ref={chainLine} fill="none" stroke="#fff6a8" strokeOpacity={0.85} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" filter="url(#puni-glow)" pointerEvents="none" />
          {items.map((it) => (it.pic ? null : <PuniBody key={it.id} look={{ ...it.look, id: it.id }} R={it.R} register={(n) => nodes.current.set(it.id, n)} />))}
        </svg>
      )}
      {/* painted characters (WebGL); touches go to the SVG underneath (hit-test is by position) */}
      <canvas ref={glCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* photos on the characters (positioned by the loop) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {items.map((it) =>
          it.photo ? (
            <div
              key={it.id}
              ref={(el) => {
                if (el) held.current.set(it.id, el);
                else held.current.delete(it.id);
              }}
              className="absolute left-0 top-0"
              style={{ transformOrigin: '50% 50%', transform: 'translate(-9999px, 0)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.photo} alt="" draggable={false} className="h-full w-full rounded-full border-[3px] border-white object-cover shadow-[0_4px_10px_rgba(60,20,110,.35)]" />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
});
