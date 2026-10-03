'use client';

import { useEffect, useState } from 'react';
import { subscribeAudio, toggleAudio } from '@/lib/audio';

/** Round play button + progress bar; all instances share one audio element (only one voice at a time). */
export function VoiceButton({ url, durationSec, label }: { url: string; durationSec?: number | null; label: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(
    () =>
      subscribeAudio((s) => {
        if (s.url === url) {
          setPlaying(s.playing);
          setProgress(s.progress);
        } else {
          setPlaying(false);
          setProgress(0);
        }
      }),
    [url],
  );

  return (
    <button
      type="button"
      onClick={() => {
        setFailed(false);
        toggleAudio(url).catch(() => setFailed(true));
      }}
      className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-200/15 to-orange-300/10 px-3 py-2.5 text-left"
      aria-label={label}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg text-amber-950 shadow-lg shadow-amber-500/20 transition group-active:scale-90">
        {playing ? '❚❚' : '▶'}
      </span>
      <span className="flex-1">
        {/* faux waveform */}
        <span className="relative flex h-7 items-center gap-[3px] overflow-hidden">
          {Array.from({ length: 28 }, (_, i) => {
            const h = 30 + ((Math.sin(i * 1.7 + url.length) + 1) / 2) * 70;
            const on = i / 28 < progress;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full ${on ? 'bg-amber-200' : 'bg-white/25'} ${playing ? 'transition-all' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </span>
        <span className="text-[10px] text-white/50">{failed ? '⚠︎' : durationSec ? `${durationSec.toFixed(1)}s` : label}</span>
      </span>
    </button>
  );
}
