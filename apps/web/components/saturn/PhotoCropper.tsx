'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fit a photo into the round frame (client decision 2026-10-07: photos on Saturn are round).
 * Drag to move, pinch or use the slider to zoom; the circle is what everyone will see.
 * Exports a square JPEG (800 px) — it is always shown cut round.
 */
const V = 260;
const OUT = 800;

export function PhotoCropper({ file, onDone, onCancel }: { file: File; onDone: (blob: Blob) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [err, setErr] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number } | null>(null);

  useEffect(() => {
    let live = true;
    const u = URL.createObjectURL(file);
    setUrl(u);
    setErr(false);
    const i = new Image();
    i.onload = () => {
      if (!live) return;
      setImg(i);
      const s = V / Math.min(i.naturalWidth, i.naturalHeight);
      setOff({ x: (V - i.naturalWidth * s) / 2, y: (V - i.naturalHeight * s) / 2 });
    };
    i.onerror = () => live && setErr(true);
    i.src = u;
    return () => {
      live = false;
      URL.revokeObjectURL(u);
    };
  }, [file]);

  const base = img ? V / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const s = base * zoom;
  const w = (img?.naturalWidth ?? 0) * s;
  const h = (img?.naturalHeight ?? 0) * s;
  // the photo always covers the circle
  const clamp = (o: { x: number; y: number }, ww = w, hh = h) => ({ x: Math.min(0, Math.max(V - ww, o.x)), y: Math.min(0, Math.max(V - hh, o.y)) });

  const setZoomAround = (z: number) => {
    if (!img) return;
    const nz = Math.max(1, Math.min(4, z));
    const ns = base * nz;
    // keep the middle of the circle where it is
    const cx = (V / 2 - off.x) / s;
    const cy = (V / 2 - off.y) / s;
    setZoom(nz);
    setOff(clamp({ x: V / 2 - cx * ns, y: V / 2 - cy * ns }, img.naturalWidth * ns, img.naturalHeight * ns));
  };

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomAround(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d));
    } else if (pointers.current.size === 1) {
      setOff((o) => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }));
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const done = () => {
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = c.height = OUT;
    const k = OUT / V;
    c.getContext('2d')!.drawImage(img, off.x * k, off.y * k, w * k, h * k);
    c.toBlob((b) => (b ? onDone(b) : setErr(true)), 'image/jpeg', 0.88);
  };

  return (
    <div className="fixed inset-0 z-[170] flex flex-col items-center justify-center bg-violet-950/85 px-4" style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }}>
      <p className="text-sm font-black text-white">丸の中に、見せたいところを合わせてね</p>
      <p className="mt-1 text-[11px] font-bold text-white/70">指でうごかす・2本指でひろげると大きくなるよ</p>
      <div className="relative mt-5 touch-none select-none" style={{ width: V, height: V }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {img && (
          // the whole photo, dimmed outside the circle
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none opacity-35" style={{ left: off.x, top: off.y, width: w, height: h }} />
        )}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full border-4 border-white shadow-[0_0_0_9999px_rgba(30,10,60,.35)]">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" draggable={false} className="absolute max-w-none" style={{ left: off.x - 4, top: off.y - 4, width: w, height: h }} />
          )}
        </div>
        {!img && !err && <p className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">よみこみ中…</p>}
        {err && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-bold text-rose-200">この写真は読みこめなかった…別の写真でためしてね</p>}
      </div>
      <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomAround(Number(e.target.value))} className="mt-6 w-[240px] accent-pink-400" aria-label="zoom" />
      <div className="mt-6 flex w-full max-w-xs gap-2">
        <button onClick={onCancel} className="flex-1 rounded-full bg-white/20 py-3 text-sm font-black text-white">
          やめる
        </button>
        <button onClick={done} disabled={!img} className="flex-1 rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-3 text-sm font-black text-white shadow disabled:opacity-40">
          これでOK
        </button>
      </div>
    </div>
  );
}
