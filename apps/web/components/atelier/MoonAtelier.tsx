'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KINDS, type AtelierKind } from '@/lib/atelier/unlock';
import { Shell } from './Shell';
import type { RenderThread, ThreadInfo } from './threads';

/** the old atelier kinds a link may still carry (?kind=…) → what the chat asks for */
const OLD: Record<string, AtelierKind> = { voice: 'voice', art: 'art', song: 'song', video: 'video', radio: 'radio' };
const kindOf = (k: string | null): AtelierKind | null => (k && (KINDS as string[]).includes(k) ? (k as AtelierKind) : k ? (OLD[k] ?? null) : null);

/**
 * 月で作る (/moon/atelier). Since M-R210/M-R211 it is one {bati} chat with the same look for everything (AtelierChat):
 * Bluena's gate opens, and you ask {bati} in words. Coming with ?kind=… (a Bluena folder's 〔月で作る〕, Saturn's
 * 〔つぶやく〕) {bati} asks for that kind at once — or says on which day it opens. Other conversations (ダチ) plug in through
 * `threads` / `renderThread` (threads.ts). Making happens only here (M-R208),
 * and it does not use the day's 88 minutes (§13).
 */
export function MoonAtelier({ threads, renderThread }: { threads?: ThreadInfo[]; renderThread?: RenderThread } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const [gate, setGate] = useState(true);

  // the gate plays once per visit; reduced motion → straight in
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setGate(false);
    const t = setTimeout(() => setGate(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="pt-safe relative mx-auto flex h-svh max-w-xl flex-col overflow-hidden bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)] text-amber-50">
      {/* one bar: the talk's own (← back, the conversations, {bati}, Bluena) — no page header above it */}
      <Shell first={kindOf(params.get('kind'))} threads={threads} renderThread={renderThread} onBack={() => router.back()} open={params.get('thread') || params.get('job') ? { thread: params.get('thread') || 'bati', day: params.get('day') ?? undefined, at: params.get('at') ?? undefined, job: params.get('job') ?? undefined } : undefined} />
      {gate && <Gate onSkip={() => setGate(false)} />}
    </main>
  );
}

/** Bluena's gate opens and a square screen widens into the atelier (no new pictures: shapes and light only) */
function Gate({ onSkip }: { onSkip: () => void }) {
  return (
    <button onClick={onSkip} aria-label="月へ入る" className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#03040b]">
      <span className="absolute h-[70vmin] w-[70vmin] animate-[atelier-glow_1.5s_ease-out_forwards] rounded-full bg-[radial-gradient(circle,rgba(140,210,255,0.55),rgba(80,140,255,0.15)_45%,transparent_70%)]" />
      {/* the square screen */}
      <span className="absolute aspect-square w-[62vmin] animate-[atelier-screen_1.5s_cubic-bezier(.6,0,.3,1)_forwards] rounded-3xl border border-sky-100/50 bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_70%)] shadow-[0_0_60px_rgba(120,200,255,0.5)]" />
      {/* the two doors of the gate */}
      <span className="absolute left-0 top-0 h-full w-1/2 animate-[atelier-door-l_1.5s_cubic-bezier(.7,0,.3,1)_forwards] border-r border-sky-200/40 bg-gradient-to-l from-[#0e1840] to-[#03040b]" />
      <span className="absolute right-0 top-0 h-full w-1/2 animate-[atelier-door-r_1.5s_cubic-bezier(.7,0,.3,1)_forwards] border-l border-sky-200/40 bg-gradient-to-r from-[#0e1840] to-[#03040b]" />
      <span className="absolute h-16 w-16 animate-[atelier-key_1.5s_ease-out_forwards] overflow-hidden rounded-full border border-sky-200/60 shadow-[0_0_30px_rgba(140,220,255,0.9)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
      </span>
    </button>
  );
}
