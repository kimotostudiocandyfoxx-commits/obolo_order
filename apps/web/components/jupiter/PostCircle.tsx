'use client';

import { useEffect, useRef } from 'react';
import { Artwork } from '@/components/Artwork';
import { FILTERS, useBlobUrl, VIDEO_MAX_SECONDS, type FilterId, type MediaKind } from '@/lib/jupiter/state';

export interface CircleMedia {
  kind: MediaKind;
  /** https:// (uploaded) or idb:<id> (kept in this browser) */
  url?: string;
  /** a still for videos */
  poster?: string | null;
  sample?: { emoji: string; hue: number };
}

/** A round Jupiter post: photo (or an older 8-second video, looped) or emoji sample, with filter and text. New videos live in Mars's 裏スタジオ. */
export function PostCircle({
  media,
  filter = 'none',
  text,
  className = '',
  live = false,
}: {
  media: CircleMedia;
  filter?: FilterId;
  text?: string;
  className?: string;
  /** play videos (otherwise the first frame) */
  live?: boolean;
}) {
  const local = useBlobUrl(media.url?.startsWith('idb:') ? media.url.slice(4) : undefined);
  const url = media.url?.startsWith('idb:') ? local : (media.url ?? null);
  const video = useRef<HTMLVideoElement>(null);
  const css = FILTERS.find((f) => f.id === filter)?.css ?? 'none';

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (live) v.play().catch(() => {});
    else v.pause();
  }, [live, url]);

  return (
    <div className={`relative aspect-square overflow-hidden rounded-full bg-[#f3e6d2] ${className}`}>
      <div className="absolute inset-0" style={{ filter: css }}>
        {media.sample ? (
          <Artwork hue={media.sample.hue} emoji={media.sample.emoji} className="h-full w-full" />
        ) : url && media.kind === 'video' ? (
          <video
            ref={video}
            src={url}
            muted={!live}
            playsInline
            loop
            preload="metadata"
            poster={media.poster ?? undefined}
            className="h-full w-full object-cover"
            onTimeUpdate={(e) => {
              // 8-second limit: longer clips loop their first 8 seconds
              if (e.currentTarget.currentTime >= VIDEO_MAX_SECONDS) e.currentTarget.currentTime = 0;
            }}
          />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      {media.kind === 'video' && !live && (
        <span className="absolute right-[14%] top-[14%] rounded-full bg-black/45 px-1.5 text-[10px] text-white">▶</span>
      )}
      {text && (
        <div className="absolute inset-x-[12%] bottom-[14%] text-center">
          <span className="inline-block rounded-full bg-white/80 px-3 py-1 text-[clamp(10px,4.2cqw,18px)] font-bold leading-snug text-stone-700 shadow-sm">
            {text}
          </span>
        </div>
      )}
    </div>
  );
}
