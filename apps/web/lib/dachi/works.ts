'use client';

import type { DachiWorkCard } from '@obolo/shared';
import { getApi } from '@/lib/api';

/** a work in your Bluena, ready to be sent as a card in a ダチ thread (M-R212) */
export type BluenaWork = { key: string; card: DachiWorkCard; image?: string | null; at: string };

const web = (u: string | null | undefined) => (u && /^https?:\/\//.test(u) ? u : undefined);
const uuid = (id: string) => (/^[0-9a-f-]{36}$/i.test(id) ? id : undefined);

/**
 * Your works, from the same lists Bluena shows (BluenaView's folders): Saturn's kororin (つぶやき), Jupiter's art, Mercury's
 * songs, Mars's videos, Venus's shows. Newest first. A folder that fails to load is just left out.
 */
export async function loadBluenaWorks(meId: string): Promise<BluenaWork[]> {
  const api = getApi();
  const [posts, roots, songs, videos, shows] = await Promise.allSettled([
    api.saturnUserPosts(meId).then((p) => p.items.filter((x) => !x.replyToId)),
    api.jupiterRoots(),
    api.savedSongs(),
    api.marsBackstage(),
    api.myRadioShows(),
  ]);
  const ok = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === 'fulfilled' ? r.value : []);
  const out: BluenaWork[] = [
    ...ok(posts).map((p) => ({ key: `s:${p.id}`, at: p.createdAt, image: p.photoUrl ?? null, card: { kind: 'kororin' as const, title: '', text: p.text.slice(0, 200), url: web(p.voiceUrl), posterUrl: web(p.photoUrl), refId: uuid(p.id) } })),
    ...ok(roots).map((r) => ({ key: `j:${r.id}`, at: r.createdAt, image: r.posterUrl ?? (r.kind === 'photo' ? r.url : null), card: { kind: r.kind === 'photo' ? ('art' as const) : ('video' as const), title: '', text: '', url: web(r.url), posterUrl: web(r.posterUrl), refId: uuid(r.id) } })),
    ...ok(songs).map((s) => ({ key: `m:${s.id}`, at: s.savedAt ?? '', image: null, card: { kind: 'song' as const, title: s.title.slice(0, 60), text: '', url: web(s.url), refId: uuid(s.id) } })),
    ...ok(videos).map((v) => ({ key: `v:${v.id}`, at: v.createdAt, image: v.posterUrl, card: { kind: 'mv' as const, title: v.title.slice(0, 60), text: '', url: web(v.url), posterUrl: web(v.posterUrl), refId: uuid(v.id) } })),
    ...ok(shows).map((s) => ({ key: `r:${s.id}`, at: s.createdAt, image: s.thumbUrl, card: { kind: 'radio' as const, title: s.title.slice(0, 60), text: '', url: web(s.audioUrl), posterUrl: web(s.thumbUrl), refId: uuid(s.id) } })),
  ];
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** what a card's kind is called on screen */
export const WORK_WORD: Record<DachiWorkCard['kind'], string> = {
  kororin: 'つぶやき',
  jacket: 'ジャケット',
  song: '曲',
  mv: '映像',
  stage: 'ステージ',
  book: '物語',
  art: 'アート',
  video: '映像',
  radio: 'ラジオ',
};
