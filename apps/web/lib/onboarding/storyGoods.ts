import type { GoodsKind, GoodsMakeBody, GoodsView, JupiterRootView } from '@obolo/shared';

/**
 * Day 10 (Uranus, M-URANUS): the goods made inside the story become a REAL goods item of the member and stand in their
 * shop on the new Uranus home — the script's 「グッズを作ってお店に並べるのは誰でも」. The Moon's own maker is used as it is
 * (POST /moon/goods: a kind and one of the member's own arts, free — no picture is painted, nothing is ordered or paid),
 * then 〔公開する〕 flies it (POST /moon/goods/:id/fly). One work = one item: the id is remembered on the device, so
 * playing the scene again does not make a second one.
 *
 * It needs one of the member's real arts (a jupiter_roots picture). The art chosen in the story is used when it is one
 * of them (the same picture); a sticker of the story that is not in the member's arts, or words only, cannot be printed
 * by the real maker — then the member's newest art is NOT taken in its place (it would be a different picture from the
 * one they chose): the shelf stays on this device and the screen says so.
 */
export const STORY_SHAPE_KIND: Readonly<Record<string, GoodsKind>> = { tshirt: 'Tシャツ', mug: 'マグカップ', acrylic: 'アクスタ', sticker: 'ステッカー', badge: '缶バッジ', tote: 'トート' };

/** the member's art that IS the picture chosen in the story (the same file), if any */
export function rootOfArt(roots: readonly Pick<JupiterRootView, 'id' | 'kind' | 'url'>[], artUrl: string | null | undefined): string | null {
  if (!artUrl) return null;
  const bare = (u: string) => u.split(/[?#]/)[0];
  return roots.find((r) => r.kind === 'photo' && bare(r.url) === bare(artUrl))?.id ?? null;
}

export type StoryGoodsResult = { at: 'shop'; id: string } | { at: 'device'; why: 'no-art' | 'failed' };

export interface StoryGoodsApi {
  jupiterRoots(): Promise<JupiterRootView[]>;
  makeGoods(body: GoodsMakeBody): Promise<GoodsView>;
  flyGoods(id: string, on?: boolean): Promise<{ id: string; flownAt: string | null }>;
}

/** make the story's goods for real and fly it to the member's shop (`sentId`: already made on an earlier play — only flown again) */
export async function publishStoryGoods(api: StoryGoodsApi, shape: string, artUrl: string | null | undefined, sentId?: string | null): Promise<StoryGoodsResult> {
  try {
    let id = sentId ?? null;
    if (!id) {
      const rootId = rootOfArt(await api.jupiterRoots(), artUrl);
      const kind = STORY_SHAPE_KIND[shape];
      if (!rootId || !kind) return { at: 'device', why: 'no-art' };
      id = (await api.makeGoods({ kind, rootId })).id;
    }
    await api.flyGoods(id, true);
    return { at: 'shop', id };
  } catch {
    return { at: 'device', why: 'failed' };
  }
}

/** the screen's own note under the shelf (not a character's line) */
export function storyGoodsNote(r: StoryGoodsResult | 'preview' | null): string {
  if (r === null) return '（お店の棚に、並べています……）';
  if (r !== 'preview' && r.at === 'shop') return '（天王星の{neo}のお店に並びました。ダチと、推してくれている人のホームにも、88時間とどきます）';
  if (r !== 'preview' && r.why === 'no-art') return '（この絵は、木星のアートではないので、お店の棚は、いまはこの端末の中だけです。月の工房でグッズを作ると、お店に並びます）';
  return '（お店の棚は、いまはこの端末の中だけに並びます。ダチには、まだ見えません）';
}
