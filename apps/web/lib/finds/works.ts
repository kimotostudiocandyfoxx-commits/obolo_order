'use client';

import { goodsKindOf, KIND_HOME_PLANET, matchesFind, type BluenaPlanet, type FindWorksQuery, type FoundWork, type MarkedKind } from '@obolo/shared';
import type { GlyphId } from '@/components/bluena/glyphs';
import { shelf } from '@/components/atelier/shelf';
import type { Work } from '@/components/atelier/work';
import { getApi } from '@/lib/api';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { markOf } from './marks';
import { bookCoverUrl } from '@/components/atelier/BookRead';

/** M-R237: each planet's colour and mark in Bluena's orbit and spiral (never the colour alone) */
export const PLANET_COLOR: Record<BluenaPlanet, string> = {
  saturn: '#e9c27a',
  jupiter: '#e0915a',
  mercury: '#6cc9f0',
  mars: '#ff6e4e',
  venus: '#f6d84c',
  uranus: '#7fe3e8',
  pluto: '#c9d3e0',
  neptune: '#7f8fff',
};
export const PLANET_GLYPH: Record<BluenaPlanet, GlyphId> = { saturn: 'voice', jupiter: 'art', mercury: 'song', mars: 'video', venus: 'radio', uranus: 'goods', pluto: 'book', neptune: 'game' };
export const PLANET_NAME: Record<BluenaPlanet, string> = { saturn: '土星', jupiter: '木星', mercury: '水星', mars: '火星', venus: '金星', uranus: '天王星', pluto: '冥王星', neptune: '海王星' };
/** what the Moon atelier makes for each planet (story 2026-11-25: グッズ too) */
export const PLANET_KIND: Record<BluenaPlanet, AtelierKind | null> = { saturn: 'voice', jupiter: 'art', mercury: 'song', mars: 'video', venus: 'radio', uranus: 'goods', pluto: 'novel', neptune: 'game' };
/** client 2026-11-25: the one shared map (KIND_HOME_PLANET), for the kinds the atelier makes */
export const KIND_PLANET: Partial<Record<AtelierKind, BluenaPlanet>> = Object.fromEntries(Object.entries(KIND_HOME_PLANET).filter(([k]) => k !== 'book'));

/** when a device-made item was made (its id starts with Date.now() in base 36, work.ts uid) */
export function madeAt(id: string): string {
  const t = parseInt(id.slice(0, 8), 36);
  return t > 1.6e12 && t < 4e12 ? new Date(t).toISOString() : new Date(0).toISOString();
}

/** where a work's ★ / mark is kept: the planet's own store, or this device */
export function workMarkRef(w: Work): { kind: MarkedKind; id: string } {
  const r = w.ref ?? {};
  if (w.kind === 'voice' && r.postId) return { kind: 'saturn_post', id: r.postId };
  if (w.kind === 'art' && r.rootId) return { kind: 'jupiter_root', id: r.rootId };
  if (w.kind === 'song' && r.songId) return { kind: 'song', id: r.songId };
  if (w.kind === 'video' && r.backstageId) return { kind: 'mars_backstage', id: r.backstageId };
  if (w.kind === 'radio' && r.showId) return { kind: 'radio_show', id: r.showId };
  if (w.kind === 'novel' && r.bookId) return { kind: 'book', id: r.bookId };
  if (w.kind === 'game' && r.gameId) return { kind: 'game', id: r.gameId };
  if (w.kind === 'goods' && r.goodsId) return { kind: 'goods', id: r.goodsId };
  return { kind: 'local', id: w.id };
}

/** a found work as the atelier's card (play / fly / throw away) */
export function workOf(f: FoundWork, local?: Work): Work {
  if (local) return local;
  const kind = PLANET_KIND[f.planet] ?? 'image';
  const ref: Work['ref'] =
    f.kind === 'book' ? { bookId: f.id } : f.kind === 'game' ? { gameId: f.id } : f.kind === 'goods' ? { goodsId: f.id } : f.kind === 'saturn_post' ? { postId: f.id } : f.kind === 'jupiter_root' ? { rootId: f.id } : f.kind === 'song' ? { songId: f.id } : f.kind === 'mars_backstage' ? { backstageId: f.id } : f.kind === 'radio_show' ? { showId: f.id } : {};
  // story 2026-11-25: a goods item — its kind is in its name (goodsTitle: the art's title + the kind), else a tote
  if (kind === 'goods') {
    const g = goodsKindOf(f.title) ?? 'トート';
    return { id: f.id, kind, prompt: '', status: 'ready', saved: true, title: f.title, image: f.image ?? undefined, ref, flown: f.flown, home: 'uranus', goods: { id: f.id, kind: g, rootId: null, artUrl: f.image ?? '', title: f.title, flownAt: f.flown ? f.createdAt : null, home: 'uranus', createdAt: f.createdAt } };
  }
  if (kind === 'novel' || kind === 'game') return { id: f.id, kind, prompt: '', status: 'ready', saved: true, title: f.title, image: f.image ?? (kind === 'novel' ? bookCoverUrl(f.title) : undefined), ref, flown: f.flown, home: KIND_HOME_PLANET[kind] };
  return { id: f.id, kind, prompt: '', status: 'ready', saved: true, title: f.title, image: kind === 'video' ? undefined : (f.image ?? undefined), poster: kind === 'video' ? f.image : undefined, audio: f.audio ?? undefined, video: f.video ?? undefined, ref, flown: f.flown };
}

/** the works kept on this device that belong to a planet (the demo's songs) */
function localWorks(): { f: FoundWork; w: Work }[] {
  return shelf()
    .filter((w) => KIND_PLANET[w.kind])
    .map((w) => {
      const m = markOf('local', w.id);
      return { w, f: { kind: 'local', id: w.id, planet: KIND_PLANET[w.kind]!, title: w.title || w.text || w.prompt, image: w.image ?? w.poster ?? null, audio: w.audio ?? null, video: w.video ?? null, createdAt: madeAt(w.id), flown: w.flown, ...m } };
    });
}

export type Found = FoundWork & { work: Work };

/** Bluena's list (M-R237): every work, newest first — the planets' stores and this device — through the strip and the box */
export async function findAll(f: FindWorksQuery): Promise<Found[]> {
  const server = await getApi()
    .findWorks(f)
    .catch(() => [] as FoundWork[]);
  const q = f.q?.trim().toLowerCase();
  const local = localWorks().filter(
    ({ f: x, w }) => (!f.planet || x.planet === f.planet) && matchesFind(x, f) && (!q || `${x.title} ${w.prompt} ${JSON.stringify(w.ref?.demoSong ?? '')}`.toLowerCase().includes(q)),
  );
  // a local copy of a server item (the same song) is not shown twice
  const seen = new Set(server.map((x) => `${x.kind}:${x.id}`));
  return [...server.map((x) => ({ ...x, work: workOf(x) })), ...local.filter(({ w }) => !seen.has(`${workMarkRef(w).kind}:${workMarkRef(w).id}`)).map(({ f: x, w }) => ({ ...x, work: w }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
