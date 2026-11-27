import type { HomePlanet, HomeWork, PlanetHomeView } from '@obolo/shared';
import { oshiOn, rosterDayOf } from './roster';
import { templateSample } from './sample';

/**
 * The new planet homes inside the story (days 3–7, story session M-R330): the people the script names, on the sample
 * cast's figures and works (lib/planetTemplate/sample.ts — nothing is loaded or written).
 *  - `host` (Saturn: `takoyaki`): the resident's own place — たこ焼き兄妹's record, 大根カイザー's tree, フリージー's island,
 *    ヒポキン's studio, ボスG's booth. Around it: KIMORIN⭐︎ (whom the resident pushes: 『プリプリ・ボカン』 / 「うんち。」 /
 *    すね毛) and the story's cast met so far (the day's oshi roster without the hosts themselves).
 *  - `neo`: {neo}'s own place — the inviter's work (nobody in that spot when nobody invited: M-R343, no MIKIE⭐︎DRILL
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
  /** {neo}'s work of this morning flew */
  sent?: boolean;
  /** {neo}'s own work: its words (Saturn), title and picture (the others) */
  own?: { text?: string; title?: string; image?: string | null };
}

const by = (v: PlanetHomeView, name: string): HomeWork | undefined => v.around.find((w) => w.author.name === name);
const as = (w: HomeWork, id: string, o: Partial<HomeWork> & { name?: string; rel?: HomeWork['rel'] } = {}): HomeWork => {
  const { name, ...rest } = o;
  return { ...w, ...rest, id, author: { ...w.author, ...(name ? { id: `story-${name}`, name } : {}) } };
};

export function storyHome(planet: StoryPlanet, place: StoryPlace, o: StoryCastInput, now = Date.now()): PlanetHomeView {
  // the day this planet is visited on: its roster (M-R341); MIKIE⭐︎DRILL is in the sample only to lend the inviter a work
  const day = rosterDayOf(planet as HomePlanet);
  const sample = templateSample(planet as HomePlanet, now, { day, ordered: true });
  // MONBAN's own figure and work (he is an oshi only from day 10: taken from the full roster's sample)
  const monban = planet === 'saturn' ? by(templateSample('saturn', now), 'MONBAN') : undefined;
  const kimorin = by(sample, 'KIMORIN⭐︎')!;
  const mikie = by(sample, 'MIKIE⭐︎DRILL')!;
  const k = KIMORIN_WORK[planet];
  /** one work each of the day's oshi, in the roster's order */
  const oshi = (skip: string[] = []) =>
    oshiOn(day)
      .filter((p) => !skip.includes(p.name))
      .flatMap((p, i) => {
        const w = by(sample, p.name);
        return w ? [as(w, `st-${planet}-o${i}`, { rel: 'oshi' })] : [];
      });
  const words = (w: HomeWork, name: string) => (planet === 'saturn' && SATURN_WORDS[name] ? { text: SATURN_WORDS[name] } : {});
  if (place !== 'neo') {
    // the resident's place: KIMORIN⭐︎ (pushed), and the story's cast met so far (never the hosts themselves)
    return {
      ...sample,
      owner: { id: `story-host-${planet}`, name: STORY_HOSTS[planet] },
      own: [],
      around: [
        as(kimorin, `st-${planet}-kimorin`, { ...k, rel: 'oshi' }),
        // D04-S005: MONBAN's kororin, the siblings' ダチ (the script's own)
        ...(monban ? [as(monban, `st-${planet}-monban`, { ...words(monban, 'MONBAN'), rel: 'dachi' })] : []),
        ...(planet === 'saturn' ? [as(kimorin, `st-${planet}-kimorin-2`, { ...k, rel: 'oshi' })] : []),
        ...oshi(HOST_NAMES[planet]),
      ],
      far: [],
    };
  }
  const real = !!o.inviter && o.inviter !== '…' && o.inviter !== 'MIKIE⭐︎DRILL';
  // the inviter: the planet's plain figure with their name (never MIKIE's face); nobody invited → nobody (M-R343)
  const inviter = real ? as(mikie, `st-${planet}-inviter`, { name: o.inviter!, rel: 'dachi', ...words(mikie, 'MIKIE⭐︎DRILL') }) : null;
  if (inviter) inviter.author = { ...inviter.author, figure: null, ball: null, pic: null };
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
    around: [...(inviter ? [inviter] : []), as(kimorin, `st-${planet}-kimorin`, { ...k, rel: 'dachi' }), ...oshi()],
    far: [],
  };
}
