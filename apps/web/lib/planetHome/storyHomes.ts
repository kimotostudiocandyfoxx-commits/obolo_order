import type { HomeWork, PlanetHomeView } from '@obolo/shared';

/**
 * 星のホーム inside the story (D04-S005 / D04-S005c, M-R257 / M-R259): the scripted places — nothing is loaded or written
 * (PlanetHome `view` + `seeds`). The kororins' words are the script's (the lines said after the step, word for word).
 *  - takoyaki: the takoyaki siblings' own flashy record — MONBAN's kororin (their dachi) and KIMORIN's two (whom the
 *    sister pushes), and a few others'
 *  - neo: {neo}'s new record — {neo}'s own kororin (when flown this morning, f_d04_fly = fly), the inviter's (or
 *    MIKIE⭐︎DRILL's) and KIMORIN's arriving
 */
/** the story cast's mini figures (M-R262, design/mv-art/out/chibi-*): the user stands in for {neo} in the story */
const CHIBI = (who: 'user' | 'kimorin' | 'monban' | 'mikie' | 'brother' | 'sister') => `/planet-home/chibi-${who}.webp`;
/** the takoyaki siblings' own record (their home step's backdrop) */
export const TAKOYAKI_BACKDROP = '/planet-home/bg-saturn-tako.webp';
const ago = (min: number, now: number) => new Date(now - min * 60_000).toISOString();
const w = (id: string, name: string, rel: HomeWork['rel'], text: string, min: number, now: number, pic: string | null = null, chibi: string | null = null): HomeWork => ({
  id,
  kind: 'saturn_post',
  author: { id: `story-${name}`, name, pic, chibi },
  rel,
  text,
  url: `tts:${text.replace(/[♪〈〉]/g, '')}`,
  flownAt: ago(min, now),
  demo: true,
});

export function takoyakiRecord(now = Date.now()): PlanetHomeView {
  return {
    planet: 'saturn',
    live: true,
    owner: { id: 'story-takoyaki', name: 'たこ焼き兄妹' },
    young: false,
    lastVisitAt: ago(600, now),
    own: [],
    around: [
      w('tk-monban', 'MONBAN', 'dachi', '♪……今日も、異常なし…。♪', 30, now, '/puni-test/gray.png', CHIBI('monban')),
      w('tk-kimorin-1', 'KIMORIN⭐︎', 'oshi', '♪うんち。♪', 20, now, '/puni-test/green.png', CHIBI('kimorin')),
      w('tk-kimorin-2', 'KIMORIN⭐︎', 'oshi', '♪うんち。♪', 19, now, '/puni-test/green.png', CHIBI('kimorin')),
      w('tk-a', 'ゴリラ 5454', 'oshi', '♪バナナ、うまい。♪', 90, now, '/puni-test/gorilla.png'),
      w('tk-b', 'サーモン', 'dachi', '♪おかえり。おかえり。♪', 120, now, '/puni-test/salmon.png'),
      w('tk-c', 'むらさき', 'oshi', '♪ねむい…でも楽しい。♪', 200, now, '/puni-test/purple.png'),
    ],
    far: [],
  };
}

export function neoRecord(o: { neo: string; inviter: string; fly: boolean; words?: string; now?: number }): PlanetHomeView {
  const now = o.now ?? Date.now();
  const inviter = o.inviter && o.inviter !== '…' ? o.inviter : 'MIKIE⭐︎DRILL';
  return {
    planet: 'saturn',
    live: true,
    owner: { id: 'story-neo', name: o.neo || 'あなた' },
    young: false,
    lastVisitAt: ago(600, now),
    own: o.fly ? [w('neo-own', o.neo, 'own', o.words || '……', 120, now, null, CHIBI('user'))] : [],
    around: [w('neo-inviter', inviter, 'dachi', '♪ようこそ。♪', 3, now, '/puni-test/purple.png', inviter === 'MIKIE⭐︎DRILL' ? CHIBI('mikie') : null), w('neo-kimorin', 'KIMORIN⭐︎', 'dachi', '♪うんち。♪', 1, now, '/puni-test/green.png', CHIBI('kimorin'))],
    far: [],
  };
}
