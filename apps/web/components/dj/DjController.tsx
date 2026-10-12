'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DjEngine } from '@/lib/dj/engine';
import { DjConsole } from './DjConsole';
import { ART, FONT_NUM, FONT_UI, FONTS_HREF, NEON, neon } from './skin';

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
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 bg-[#05060a] px-6 text-white"
      style={{ fontFamily: FONT_UI, backgroundImage: `radial-gradient(ellipse at center, rgba(5,6,10,0.25) 0%, rgba(5,6,10,0.8) 75%), url(${ART.stage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <link rel="stylesheet" href={FONTS_HREF} precedence="default" />
      {backHref && (
        <Link href={backHref} className="absolute left-3 top-[calc(8px+env(safe-area-inset-top))] rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
          ← もどる
        </Link>
      )}
      <p
        className="text-3xl font-extrabold tracking-[0.3em]"
        style={{ fontFamily: FONT_NUM, background: `linear-gradient(90deg, ${NEON.blue}, ${NEON.violet}, ${NEON.orange})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: `drop-shadow(0 0 10px ${NEON.violet}aa)` }}
      >
        VENUS DJ
      </p>
      <button
        onClick={() => void start()}
        disabled={starting}
        className="rounded-full px-10 py-3 text-lg disabled:opacity-50"
        style={{ ...neon(NEON.orange, true, 1.4), borderWidth: 2 }}
      >
        {starting ? '準備中…' : 'はじめる'}
      </button>
      {err && <p className="max-w-sm text-center text-xs text-rose-300">{err}</p>}
      <p className="text-xs text-white/40">スマホは横向きにしてね</p>
    </div>
  );
}
