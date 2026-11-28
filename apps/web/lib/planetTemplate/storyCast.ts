import type { HomePlanet, HomeWork, PlanetHomeView } from '@obolo/shared';
import { castAround, castByKey, castWork } from './castWorks';
import { KIMORIN, rosterDayOf } from './roster';
import { templateSample } from './sample';

/**
 * The new planet homes inside the story (days 3–7, story session M-R330): the people the script names, on the sample
 * cast's figures and works (lib/planetTemplate/sample.ts — nothing is loaded or written).
 *  - `host` (Saturn: `takoyaki`): the resident's own place — たこ焼き兄妹's record, 大根カイザー's tree, フリージー's island,
 *    ヒポキン's studio, ボスG's booth. Around it: KIMORIN⭐︎ (whom the resident pushes: 『プリプリ・ボカン』 / 「うんち。」 /
 *    すね毛) and the story's cast met so far (the day's oshi roster without the hosts themselves).
 *  - `neo`: {neo}'s own place — the inviter's REAL work of this planet (nobody in that spot when they have none here, or when nobody invited: M-R343, no MIKIE⭐︎DRILL
 *    stand-in before Order) and KIMORIN⭐︎'s come around, then the oshi of that day (M-R341: 9 on Saturn … 15 on Venus); {neo}'s own work of
 *    this morning is in the place when it flew (`sent`).
 * M-R342: nobody else — the sample people and the hosts' 「見本の住人」 of before are gone. MONBAN stays on the takoyaki
 * siblings' record only, where the script has him (D04-S005: his kororin 「……今日も、異常なし…。」, 「MONBANは、私たちの
 * ダチだワ。」); on the other hosts' places he was the earlier build's own addition and is gone (he joins the oshi on
 * day 10, Uranus).
 */
export type StoryPlace = 'takoyaki' | 'host' | 'neo';
// M-R343: days 8–10 too (Pluto: クロコパトラ's library, Neptune: オニモンク's arcade, Uranus: MONBAN's shop)
export type StoryPlanet = 'saturn' | 'jupiter' | 'mercury' | 'mars' | 'venus' | 'pluto' | 'neptune' | 'uranus';

export const STORY_HOSTS: Record<StoryPlanet, string> = { saturn: 'たこ焼き兄妹', jupiter: '大根カイザー', mercury: 'フリージー', mars: 'ヒポキン', venus: 'ボスG', pluto: 'クロコパトラ', neptune: 'オニモンク', uranus: 'MONBAN' };
/** KIMORIN⭐︎'s work on each planet, as the script tells it (Pluto: his three-line 『天才の一生』, M-PLUTO-S002; none told on Neptune / Uranus) */
const KIMORIN_WORK: Record<StoryPlanet, { title?: string; text?: string }> = {
  saturn: { text: 'うんち。' },
  jupiter: { title: 'プリプリ・ボカン' },
  mercury: { title: 'プリプリ・ボカン' },
  mars: { title: 'プリプリ・ボカン' },
  venus: { title: 'すね毛、すね毛、すね毛楽しい！' },
  pluto: { title: '天才の一生', text: 'KIMORIN⭐︎は、生まれた。\n天才だった。\n今も、天才である。' },
  neptune: {},
  uranus: {},
};
const SATURN_WORDS: Record<string, string> = { MONBAN: '……今日も、異常なし…。', 'MIKIE⭐︎DRILL': 'ようこそ。' };
/** the two hosts of Saturn's record share one place */
const HOST_NAMES: Record<StoryPlanet, string[]> = { saturn: ['たこ焼きブラザー', 'たこ焼きシスター'], jupiter: ['大根カイザー'], mercury: ['フリージー'], mars: ['ヒポキン'], venus: ['ボスG', 'ロングG', 'ハットG'], pluto: ['クロコパトラ'], neptune: ['オニモンク'], uranus: ['MONBAN'] };

export interface StoryCastInput {
  neo: string;
  /** the inviter's name ('' / '…' / the old stand-in's name: nobody invited → nobody in that spot, M-R343) */
  inviter?: string;
  /** the inviter's real work on this planet (GET /planet-home/<planet>/person/<inviter>: the newest), none: nobody in that spot */
  inviterWork?: HomeWork | null;
  /** {neo}'s work of this morning flew */
  sent?: boolean;
  /** {neo}'s own work: its words (Saturn), title and picture (the others) */
  own?: { text?: string; title?: string; image?: string | null };
}

const as = (w: HomeWork, id: string, o: Partial<HomeWork> & { name?: string; rel?: HomeWork['rel'] } = {}): HomeWork => {
  const { name, ...rest } = o;
  return { ...w, ...rest, id, author: { ...w.author, ...(name ? { id: `story-${name}`, name } : {}) } };
};

/**
 * M-R344: the cast come with their real works (lib/planetTemplate/castWorks.ts — one per planet, opened the cast's
 * way: their voice, the picture book, the tap game). Where the SCRIPT names a work of its own for someone — KIMORIN⭐︎'s
 * 『プリプリ・ボカン』 / 「うんち。」 / すね毛 / 『天才の一生』, MONBAN's 「……今日も、異常なし…。」 — the script's words are
 * shown as written, on that person's figure, and their recorded line (which says something else) is not played over it.
 */
function scripted(planet: StoryPlanet, key: string, id: string, rel: HomeWork['rel'], o: { title?: string; text?: string }, now: number): HomeWork {
  const c = castByKey(key)!;
  const w = castWork(planet as HomePlanet, c, rel, new Date(now - 3600_000).toISOString());
  if (!o.title && !o.text) return w;
  // the script's own words: a Saturn line has no voice of its own yet; Pluto's three lines are not his picture book
  return { ...w, id, ...o, ...(planet === 'saturn' ? { url: null } : {}), ...(planet === 'pluto' ? { thumbUrl: null } : {}) };
}

export function storyHome(planet: StoryPlanet, place: StoryPlace, o: StoryCastInput, now = Date.now()): PlanetHomeView {
  // the day this planet is visited on: its roster (M-R341)
  const day = rosterDayOf(planet as HomePlanet);
  const sample = templateSample(planet as HomePlanet, now, { day, ordered: false });
  const k = KIMORIN_WORK[planet];
  const kimorin = (rel: HomeWork['rel'], n = '') => scripted(planet, KIMORIN.pic, `st-${planet}-kimorin${n}`, rel, k, now);
  /** one work each of the day's oshi, in the roster's order (their own) */
  const oshi = (skip: string[] = []) => castAround(planet as HomePlanet, { day, ordered: false }, now - 2 * 3600_000).filter((w) => w.rel === 'oshi' && !skip.includes(w.author.name));
  if (place !== 'neo') {
    // the resident's place: KIMORIN⭐︎ (pushed), and the story's cast met so far (never the hosts themselves)
    return {
      ...sample,
      owner: { id: `story-host-${planet}`, name: STORY_HOSTS[planet] },
      own: [],
      around: [
        kimorin('oshi'),
        // D04-S005: MONBAN's kororin, the siblings' ダチ (the script's own words)
        ...(planet === 'saturn' ? [scripted(planet, 'monban', `st-${planet}-monban`, 'dachi', { text: SATURN_WORDS.MONBAN }, now)] : []),
        ...(planet === 'saturn' ? [kimorin('oshi', '-2')] : []),
        ...oshi(HOST_NAMES[planet]),
      ],
      far: [],
    };
  }
  // the inviter is a real member (story 2026-11-28): their REAL work of this planet comes (the page loads it — the newest
  // one they flew here); when they have none here, or nobody invited (M-R343), nobody is in that spot. Never a sample.
  const inviter: HomeWork | null = o.inviterWork ? { ...o.inviterWork, rel: 'dachi', flownAt: new Date(now - 1800_000).toISOString() } : null;
  const mine = sample.own[0];
  const own: HomeWork[] =
    o.sent && mine
      ? [
          {
            ...mine,
            id: `st-${planet}-own`,
            author: { ...mine.author, id: 'story-neo', name: o.neo || 'あなた' },
            ...(o.own?.text ? { text: o.own.text } : {}),
            ...(o.own?.title ? { title: o.own.title } : {}),
            ...(o.own?.image ? (planet === 'jupiter' ? { url: o.own.image, thumbUrl: o.own.image } : { thumbUrl: o.own.image }) : {}),
          },
        ]
      : [];
  return {
    ...sample,
    owner: { id: 'story-neo', name: o.neo || 'あなた' },
    own,
    around: [...(inviter ? [inviter] : []), kimorin('dachi'), ...oshi()],
    far: [],
  };
}
