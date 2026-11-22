'use client';

import type { BuddySource } from '@obolo/shared';
import { useEffect, useState } from 'react';

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

/**
 * M-R223 (D03-S008 「写真や地図、絵が出ることもある」): a question about a place gets a small map under the answer. The place
 * is read from the question (「〜はどこ」「〜の地図」「〜への行き方」…), found on OpenStreetMap (Nominatim, no key) and shown
 * as its embed with a link to the full map; a place the map does not know shows nothing.
 */
export function placeOf(question: string): string | null {
  const q = question.trim().replace(/[？?！!。、\s]+$/u, '');
  if (!/どこ|地図|場所|行き方|への道|近く|where|map/i.test(q)) return null;
  const m =
    /^(.+?)(?:って|は|の|が|に|へ)?(?:どこ|地図|場所|行き方|への道|の近く)/u.exec(q) ??
    /where\s+is\s+(.+)$/i.exec(q) ??
    /map\s+of\s+(.+)$/i.exec(q);
  const place = m?.[1]?.replace(/^(ねえ|ねぇ|あの|えっと)[、,\s]*/u, '').replace(/(って|は|の|が|へ|に)$/u, '').trim();
  return place && place.length <= 40 && !/^(ここ|そこ|あそこ|私|ぼく|ボク|わたし)$/u.test(place) ? place : null;
}

export function osmSearchUrl(place: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(place)}`;
}

export function osmEmbedUrl(lat: number, lon: number, d = 0.02) {
  const bbox = [lon - d, lat - d * 0.7, lon + d, lat + d * 0.7].map((x) => x.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export function PlaceMap({ place, tone = 'moon' }: { place: string; tone?: 'moon' | 'story' }) {
  const [at, setAt] = useState<{ lat: number; lon: number } | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ja&q=${encodeURIComponent(place)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ lat: string; lon: string }[]>) : []))
      .then((rows) => live && setAt(rows[0] ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) } : null))
      .catch(() => live && setAt(null));
    return () => {
      live = false;
    };
  }, [place]);
  const chip = tone === 'story' ? 'text-amber-50/70' : 'text-white/65';
  // only a place the map knows (「宇宙の果てはどこ？」 gets no map)
  if (!at) return null;
  return (
    <figure className="w-64 max-w-full overflow-hidden rounded-2xl bg-white/10">
      {<iframe title={`${place}の地図`} src={osmEmbedUrl(at.lat, at.lon)} className="aspect-[4/3] w-full border-0" loading="lazy" />}
      <figcaption className={`px-2 py-1 text-[11px] ${chip}`}>
        <a href={osmSearchUrl(place)} target="_blank" rel="noopener noreferrer nofollow" className="underline">
          {place}の地図を見る
        </a>
        <span className="ml-1 opacity-60">© OpenStreetMap</span>
      </figcaption>
    </figure>
  );
}
