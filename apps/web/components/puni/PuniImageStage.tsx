'use client';

import { useEffect, useRef, useState } from 'react';
import { makeRenderer } from '@/lib/puni/gl';
import { createBlob, N, poke, step, type Blob } from '@/lib/puni/physics';

/**
 * ぷにぷに with painted pictures (prototype, client request 2026-10-07): the same soft-body
 * physics, but each character is a round illustration warped onto its body — the picture is
 * cut into triangles (centre + two neighbouring edge points) and every triangle is drawn with
 * the affine transform that maps it onto the deformed body. So the painting itself dents,
 * squashes, stretches and rolls. Pictures: cut from the client's reference image (test only).
 */
interface Pic {
  id: string;
  name: string;
  src: string;
  line: string;
}

const PICS: Pic[] = [
  { id: 'salmon', name: 'サーモン', src: '/puni-test/salmon.png', line: 'わっ！くすぐったい〜' },
  { id: 'gray', name: 'グレー', src: '/puni-test/gray.png', line: 'えへへ、さわった？' },
  { id: 'green', name: 'みどり', src: '/puni-test/green.png', line: 'ぷにっ！' },
  { id: 'purple', name: 'ごま', src: '/puni-test/purple.png', line: 'ラーメン食べたーい！' },
  { id: 'gorilla', name: 'ゴリラ', src: '/puni-test/gorilla.png', line: 'やっほー！' },
];

export function PuniImageStage() {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shadowCanvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [bubble, setBubble] = useState<{ id: string; text: string } | null>(null);
  const blobs = useRef<Blob[]>([]);
  const imgs = useRef(new Map<string, HTMLImageElement>());
  const bubbleEl = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;

  useEffect(() => {
    for (const p of PICS) {
      const img = new Image();
      img.src = p.src;
      imgs.current.set(p.id, img);
    }
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const R = Math.max(42, Math.min(96, Math.min(size.W * 0.115, size.H * 0.095)));
  const floorAt = (x: number) => {
    // the same kind of curved planet horizon as Saturn
    const rx = size.W * 0.78;
    const ry = size.H * 0.5;
    const cy = size.H * 0.67 + ry;
    const dx = Math.min(0.999, Math.abs(x - size.W / 2) / rx);
    return cy - ry * Math.sqrt(1 - dx * dx) + 12;
  };

  useEffect(() => {
    if (!size.W) return;
    const prev = new Map(blobs.current.map((b) => [b.id, b]));
    blobs.current = PICS.map((p, i) => {
      const b = prev.get(p.id) ?? createBlob(p.id, size.W * (0.15 + i * 0.17), -R * 2 - i * R * 1.4, R, 'round');
      b.R = R;
      return b;
    });
  }, [size.W, R]);

  useEffect(() => {
    if (!size.W) return;
    const cv = canvas.current!;
    const sc = shadowCanvas.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, sc]) {
      c.width = size.W * dpr;
      c.height = size.H * dpr;
    }
    const gl = makeRenderer(cv);
    const ctx = sc.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let talk = 0;
    const world = { W: size.W, H: size.H, floor: size.H, floorAt };
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const sp = bubbleRef.current ? blobs.current.find((b) => b.id === bubbleRef.current!.id) : undefined;
      talk += dt;
      if (sp && talk > 0.16) {
        talk = 0;
        for (let i = 0; i < N; i++) sp.ov[i] += (Math.random() - 0.3) * 150;
      }
      for (let k = 0; k < 2; k++) step(blobs.current, dt / 2, world);
      // soft shadows on the ground (2D canvas under the characters)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.W, size.H);
      ctx.fillStyle = 'rgba(80,30,110,.16)';
      for (const b of blobs.current) {
        ctx.beginPath();
        ctx.ellipse(b.x, floorAt(b.x) - 4, b.R * 0.8, b.R * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (gl) {
        gl.frame(size.W, size.H);
        for (const b of blobs.current) {
          const img = imgs.current.get(b.id);
          const t = img && gl.texture(b.id, img);
          if (t) gl.draw(b, t);
        }
      }
      if (sp && bubbleEl.current) {
        const w = bubbleEl.current.offsetWidth;
        const left = Math.max(10, Math.min(size.W - w - 10, sp.x - w / 2));
        bubbleEl.current.style.transform = `translate(${left}px, ${sp.y - sp.R * 1.2 - bubbleEl.current.offsetHeight - 8}px)`;
        bubbleEl.current.style.opacity = '1';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // touch: tap = poke + talk, drag = throw
  const pt = useRef<{ id: number; b: Blob | null; x0: number; y0: number; moved: boolean; hist: { x: number; y: number; t: number }[] } | null>(null);
  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    const p = pos(e);
    let b: Blob | null = null;
    for (let i = blobs.current.length - 1; i >= 0; i--) if (Math.hypot(p.x - blobs.current[i].x, p.y - blobs.current[i].y) < blobs.current[i].R * 1.1) b = b ?? blobs.current[i];
    if (b) canvas.current?.setPointerCapture(e.pointerId);
    pt.current = { id: e.pointerId, b, x0: p.x, y0: p.y, moved: false, hist: [{ ...p, t: performance.now() }] };
  };
  const move = (e: React.PointerEvent) => {
    const t = pt.current;
    if (!t || t.id !== e.pointerId || !t.b) return;
    const p = pos(e);
    t.hist.push({ ...p, t: performance.now() });
    if (t.hist.length > 6) t.hist.shift();
    if (!t.moved && Math.hypot(p.x - t.x0, p.y - t.y0) > 8) t.moved = true;
    if (t.moved) t.b.drag = { tx: p.x, ty: p.y };
  };
  const up = (e: React.PointerEvent) => {
    const t = pt.current;
    pt.current = null;
    if (!t || t.id !== e.pointerId) return;
    if (!t.b) {
      if (!t.moved) setBubble(null);
      return;
    }
    const b = t.b;
    if (t.moved) {
      b.drag = null;
      const a = t.hist[0];
      const z = t.hist[t.hist.length - 1];
      const dt = Math.max(0.016, (z.t - a.t) / 1000);
      b.vx = Math.max(-2400, Math.min(2400, (z.x - a.x) / dt));
      b.vy = Math.max(-2400, Math.min(2400, (z.y - a.y) / dt));
      b.av = b.vx / b.R / 2;
    } else {
      const p = pos(e);
      poke(b, p.x, p.y);
      const pic = PICS.find((x) => x.id === b.id)!;
      setBubble({ id: b.id, text: pic.line });
      // a stand-in voice for the test (real posts play their own voice)
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(pic.line);
        u.lang = 'ja-JP';
        u.pitch = 1.6;
        u.rate = 1.1;
        u.onend = () => setBubble((cur) => (cur?.id === b.id ? null : cur));
        speechSynthesis.speak(u);
      } catch {
        setTimeout(() => setBubble((cur) => (cur?.id === b.id ? null : cur)), 1800);
      }
    }
  };

  const scatter = () => {
    for (const b of blobs.current) {
      b.vy = -800 - Math.random() * 500;
      b.vx = (Math.random() - 0.5) * 1000;
      b.av = (Math.random() - 0.5) * 8;
    }
  };

  return (
    <div ref={box} className="relative h-full w-full touch-none select-none overflow-hidden" style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", system-ui, sans-serif' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#2f2268] via-[#6d48b0] to-[#e6a3cf]" />
      <div className="starfield" aria-hidden />
      <div
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          left: '-28%',
          width: '156%',
          top: '67%',
          height: '100%',
          background: 'repeating-radial-gradient(ellipse farthest-side at 50% 50%, #ffdccf 0 3%, #fcc8cc 3% 6%, #f7b6cf 6% 9%, #ffe4d8 9% 12%, #fff4ee 12% 12.6%)',
          boxShadow: 'inset 0 10px 18px rgba(255,255,255,.65), 0 -10px 40px rgba(255,190,225,.55)',
        }}
      />
      <canvas ref={shadowCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {bubble && (
        <div ref={bubbleEl} className="pointer-events-none absolute left-0 top-0 max-w-[240px] rounded-2xl bg-white px-3 py-2 text-[15px] font-black text-[#3d2a5c] opacity-0 shadow-xl">
          {bubble.text}
        </div>
      )}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 px-4 text-center">
        <p className="mt-10 text-lg font-black text-white drop-shadow">ぷにぷに試作（絵のキャラ）</p>
        <p className="text-[11px] font-bold text-white/80">タップ：つつく＋しゃべる ／ ドラッグ：伸ばして投げる</p>
        <p className="mt-1 text-[10px] text-white/60">※ 絵はいただいた参考画像から切り抜いたテスト用</p>
      </div>
      <button onClick={scatter} className="pb-safe absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-black text-violet-600 shadow">
        🎉 ばらまく
      </button>
    </div>
  );
}
