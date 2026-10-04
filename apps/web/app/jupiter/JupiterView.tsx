'use client';

import { useEffect, useState } from 'react';
import { Artwork } from '@/components/Artwork';
import { PlanetShell } from '@/components/PlanetShell';
import { useI18n } from '@/lib/i18n/client';
import { compact, PHOTOS, TRACKS, tr, type SamplePhoto } from '@/lib/samples';
import { synth } from '@/lib/synth';

/** Jupiter (spec §2.4): square photo grid; every post carries a sound. VISUAL DEMO (P-DEMO-1). */
export function JupiterView() {
  const { m } = useI18n();
  const [open, setOpen] = useState<SamplePhoto | null>(null);
  useEffect(() => () => synth.stop(), []);

  return (
    <PlanetShell id="jupiter">
      <p className="mb-1 text-sm font-bold">📷＋🎵 {m.jupiter.lead}</p>
      <p className="mb-4 text-[11px] text-white/45">{m.jupiter.audioRequired}</p>
      <PhotoGrid onOpen={setOpen} />
      {open && (
        <PhotoModal
          photo={open}
          onClose={() => {
            synth.stop();
            setOpen(null);
          }}
        />
      )}
    </PlanetShell>
  );
}

/** Square photo grid of the sample posts (also used by the Day 5 tutorial). */
export function PhotoGrid({ onOpen }: { onOpen: (p: SamplePhoto) => void }) {
  const { locale } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
      {PHOTOS.map((p) => (
        <button key={p.id} onClick={() => onOpen(p)} className="relative" aria-label={tr(p.caption, locale)}>
          <Artwork hue={p.hue} emoji={p.emoji} />
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[10px]">🎵</span>
        </button>
      ))}
    </div>
  );
}

export function PhotoModal({
  photo,
  onClose,
  onPlay,
  onStar,
}: {
  photo: SamplePhoto;
  onClose: () => void;
  onPlay?: () => void;
  onStar?: () => void;
}) {
  const { m, locale } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [starred, setStarred] = useState(false);
  const track = TRACKS.find((t) => t.id === photo.trackId)!;
  const toggle = () => {
    if (playing) synth.stop();
    else {
      synth.play(track);
      onPlay?.();
    }
    setPlaying(!playing);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button onClick={toggle} className="block w-full">
          <Artwork hue={photo.hue} emoji={photo.emoji} animated={playing} />
        </button>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="font-bold">@{photo.author}</span>
            <span className="text-xs text-white/50">· {tr(photo.sound, locale)}</span>
          </div>
          <p className="mt-1 text-sm text-white/85">{tr(photo.caption, locale)}</p>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn btn-primary flex-1" onClick={toggle}>
              {playing ? '❚❚' : '▶'} {m.jupiter.playSound}
            </button>
            <button
              className={`btn btn-ghost ${starred ? 'text-[color:var(--color-star)]' : ''}`}
              onClick={() => {
                if (!starred) onStar?.();
                setStarred(!starred);
              }}
            >
              {starred ? '★' : '☆'} {compact(photo.stars + (starred ? 1 : 0), locale)}
            </button>
          </div>
          <button className="mt-3 w-full text-xs text-white/50" onClick={onClose}>
            {m.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
