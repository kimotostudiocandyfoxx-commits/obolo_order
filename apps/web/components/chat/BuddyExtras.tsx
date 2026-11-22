'use client';

import type { BuddySource } from '@obolo/shared';

/**
 * M-R208: what {bati} looked up or drew, under its answer — the pages as small link chips (title + site), and a
 * picture it drew as its own bubble. Used by the Moon chat and the story's chat step.
 */
export function SourceChips({ sources, tone = 'moon' }: { sources?: BuddySource[]; tone?: 'moon' | 'story' }) {
  if (!sources?.length) return null;
  const chip =
    tone === 'story'
      ? 'border-amber-200/30 bg-amber-200/[0.06] text-amber-50/80'
      : 'border-white/15 bg-white/[0.06] text-white/75';
  return (
    <ul className="flex max-w-full flex-wrap gap-1.5" aria-label="調べたページ">
      {sources.slice(0, 3).map((s) => (
        <li key={s.url} className="min-w-0 max-w-full">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`flex min-h-8 max-w-[16rem] items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] leading-tight active:scale-95 ${chip}`}
          >
            <span className="truncate font-bold">{s.title}</span>
            <span className="shrink-0 opacity-60">{s.domain}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DrawnPicture({ url, alt = '' }: { url: string; alt?: string }) {
  return (
    <figure className="w-56 max-w-full overflow-hidden rounded-2xl rounded-bl-sm bg-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="aspect-square w-full object-cover" loading="lazy" />
    </figure>
  );
}
