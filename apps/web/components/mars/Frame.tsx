'use client';

import { Artwork } from '@/components/Artwork';
import type { Video } from '@/lib/mars/sky';
import { stillUrl } from '@/lib/onboarding/media';

/** A video's picture: its thumbnail (slowly panning while it plays) or an emoji frame. With `onEnded` a real movie plays once. */
export function Frame({ video, playing = false, className = '', onEnded }: { video: Video; playing?: boolean; className?: string; onEnded?: () => void }) {
  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <div className={`absolute inset-0 ${playing && !video.url ? 'animate-[kenburns_14s_ease-in-out_infinite_alternate]' : ''}`}>
        {video.url && playing ? (
          <video src={video.url} poster={video.poster ?? undefined} autoPlay loop={!onEnded} onEnded={onEnded} playsInline controls className="h-full w-full object-cover" />
        ) : video.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.poster} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : video.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stillUrl(video.thumb)} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <Artwork hue={video.hue ?? 20} emoji={video.emoji ?? '🎬'} animated={playing} className="h-full w-full !aspect-auto" />
        )}
      </div>
    </div>
  );
}
