'use client';

import { useEffect, useRef, useState } from 'react';

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
  const audio = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(108);
  const [blocked, setBlocked] = useState(false);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    audio.current?.pause();
    onDone();
  };
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.play().catch(() => setBlocked(true));
  }, []);
  // the lines spread over the song (after a short intro, before the outro), one at a time
  const intro = 4;
  const span = Math.max(1, dur - intro - 6);
  const k = Math.min(lines.length - 1, Math.max(0, Math.floor(((t - intro) / span) * lines.length)));
  const line = t >= intro ? lines[k] : null;
  return (
    <div className="absolute inset-0 z-[14] flex flex-col items-center justify-center bg-black">
      <audio
        ref={audio}
        src={src}
        muted={muted}
        playsInline
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
        onEnded={finish}
      />
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
      {blocked && (
        <button
          className="mt-6 rounded-full border border-pink-200/60 px-8 py-3 tracking-widest text-pink-100"
          onClick={() => {
            setBlocked(false);
            void audio.current?.play();
          }}
        >
          ▶ 再生
        </button>
      )}
      <button onClick={finish} className="pt-safe absolute right-4 top-4 rounded-full border border-white/30 px-4 py-1.5 text-xs tracking-widest text-white/70">
        スキップ
      </button>
      <style>{'@keyframes songBob{from{transform:translateY(0)}to{transform:translateY(-6px)}}'}</style>
    </div>
  );
}
