'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DjEngine } from '@/lib/dj/engine';
import { DjConsole } from './DjConsole';

/**
 * The Venus DJ (client request 2026-10-12): a start screen (iOS needs a tap before any sound), then
 * the console in the client's three-circle shape (DjConsole). Tracks: the member's own songs
 * (`songs`) or a file from the device.
 */
export interface DjTrack {
  title: string;
  url: string;
  bpm: number | null;
  /** the song's MV, for the VJ (platter and the round screen) */
  videoUrl?: string | null;
  /** the song's jacket: turns on the platter when there is no MV */
  coverUrl?: string | null;
}

export function DjController({ songs = [], backHref }: { songs?: DjTrack[]; backHref?: string }) {
  const [engine, setEngine] = useState<DjEngine | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');

  const start = async () => {
    setStarting(true);
    try {
      setEngine(await DjEngine.create());
    } catch (e) {
      setErr(String(e));
    } finally {
      setStarting(false);
    }
  };
  useEffect(() => () => engine?.close(), [engine]);

  if (engine) return <DjConsole engine={engine} songs={songs} backHref={backHref} />;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,#1d1510_0%,#070506_70%)] px-6 text-white">
      {backHref && (
        <Link href={backHref} className="absolute left-3 top-[calc(8px+env(safe-area-inset-top))] rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
          ← もどる
        </Link>
      )}
      <p className="text-lg tracking-[0.4em] text-[#e7c187]">VENUS DJ</p>
      <button
        onClick={() => void start()}
        disabled={starting}
        className="rounded-full border-2 border-[#ff9a3c] bg-[#ff9a3c]/20 px-8 py-3 font-bold text-white shadow-[0_0_18px_#ff9a3c88] disabled:opacity-50"
      >
        {starting ? '準備中…' : 'はじめる'}
      </button>
      {err && <p className="max-w-sm text-center text-xs text-rose-300">{err}</p>}
      <p className="text-xs text-white/40">スマホは横向きにしてね</p>
    </div>
  );
}
