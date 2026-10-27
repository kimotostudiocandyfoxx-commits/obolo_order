'use client';

import { useEffect, useRef, useState } from 'react';
import { audioCtx, masterBus } from '@/lib/onboarding/audio';

/**
 * A song played whole on the tower's screen (L2-MARS-S001 『MIKIE⭐︎ドリル（feat. KIMORIN⭐︎）』, M-R134: the
 * second journey's showpiece, ~108 s, never cut). Until the MV is made (videos come last) the screen shows
 * MIKIE⭐︎ and the lines of the song as it goes. 〔スキップ〕 at the corner; it ends by itself with the song.
 */
export function SongShow({
  src,
  title,
  poster,
  lines,
  muted,
  onDone,
}: {
  src: string;
  title: string;
  poster?: string;
  lines: { who: string; text: string }[];
  muted: boolean;
  onDone: () => void;
}) {
  // on the story's already unlocked audio context (an <audio> started outside a tap is blocked on iOS)
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(108);
  const [ready, setReady] = useState(false);
  const src0 = useRef<AudioBufferSourceNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    try {
      src0.current?.stop();
    } catch {
      /* not started */
    }
    onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const c = audioCtx();
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    // no sound (no audio context, or it failed): the lines still go by on the clock
    const silent = () => {
      const t0 = Date.now();
      timer = setInterval(() => setT((Date.now() - t0) / 1000), 250);
    };
    if (!c) {
      silent();
      setReady(true);
      return () => {
        if (timer) clearInterval(timer);
      };
    }
    void (async () => {
      try {
        const buf = await c.decodeAudioData(await (await fetch(src)).arrayBuffer());
        if (cancelled) return;
        const g = c.createGain();
        g.gain.value = muted ? 0 : 1;
        g.connect(masterBus(c));
        const node = c.createBufferSource();
        node.buffer = buf;
        node.connect(g);
        node.onended = () => finishRef.current();
        const at = c.currentTime;
        node.start();
        src0.current = node;
        gain.current = g;
        setDur(buf.duration);
        timer = setInterval(() => setT(c.currentTime - at), 250);
      } catch {
        if (!cancelled) silent();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        src0.current?.stop();
      } catch {
        /* not started */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  useEffect(() => {
    if (gain.current) gain.current.gain.value = muted ? 0 : 1;
  }, [muted]);
  // the silent clock ends with the song's length too
  useEffect(() => {
    if (t > dur + 1) finishRef.current();
  }, [t, dur]);
  // the lines spread over the song (after a short intro, before the outro), one at a time
  const intro = 4;
  const span = Math.max(1, dur - intro - 6);
  const k = Math.min(lines.length - 1, Math.max(0, Math.floor(((t - intro) / span) * lines.length)));
  const line = ready && t >= intro ? lines[k] : null;
  return (
    <div className="absolute inset-0 z-[14] flex flex-col items-center justify-center bg-black">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border-[6px] border-[#2a2a2a] bg-gradient-to-b from-[#3a0a3a] via-[#1a0820] to-black shadow-[0_0_80px_rgba(255,80,180,0.45)]">
        <div className="relative aspect-[4/5] w-full">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[86%] object-contain" style={{ animation: 'songBob 0.5s ease-in-out infinite alternate' }} />
          )}
          <div className="absolute inset-x-0 top-3 text-center text-[13px] font-bold tracking-wider text-pink-100 drop-shadow">{title}</div>
          {line && (
            <div key={k} className="absolute inset-x-3 bottom-4 animate-[fadeUp_0.4s_ease-out] rounded-xl bg-black/60 px-3 py-2 text-center">
              <p className="text-[11px] tracking-widest text-pink-200/80">{line.who}</p>
              {line.text.split('／').map((s, j) => (
                <p key={j} className="text-[16px] font-bold leading-snug text-white">
                  {s}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="h-1 w-full bg-white/10">
          <div className="h-full bg-pink-400" style={{ width: `${Math.min(100, (t / dur) * 100)}%` }} />
        </div>
      </div>
      <button onClick={finish} className="absolute bottom-[calc(24px+env(safe-area-inset-bottom))] right-4 z-[2] rounded-full border border-white/30 px-4 py-1.5 text-xs tracking-widest text-white/70">
        スキップ
      </button>
      <style>{'@keyframes songBob{from{transform:translateY(0)}to{transform:translateY(-6px)}}'}</style>
    </div>
  );
}
