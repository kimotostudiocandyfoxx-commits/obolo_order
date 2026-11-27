import type { HomePlanet, HomeWork, PlanetHomeView } from '@obolo/shared';
import { templateSample } from './sample';

/**
 * The new planet homes inside the story (days 3–7, story session M-R330): the people the script names, on the sample
 * cast's figures and works (lib/planetTemplate/sample.ts — nothing is loaded or written).
 *  - `host` (Saturn: `takoyaki`): the resident's own place — たこ焼き兄妹's record, 大根カイザー's tree, フリージー's island,
 *    ヒポキン's studio, ボスG's booth. Around it: KIMORIN⭐︎ (whom the resident pushes: 『プリプリ・ボカン』 / 「うんち。」 /
 *    すね毛) and their dachi MONBAN, and a few more residents so the place is alive.
 *  - `neo`: {neo}'s own place — the inviter's work (MIKIE⭐︎DRILL's when nobody invited) and KIMORIN⭐︎'s come around;
 *    {neo}'s own work of this morning is in the place when it flew (`sent`).
 */
export type StoryPlace = 'takoyaki' | 'host' | 'neo';
export type StoryPlanet = 'saturn' | 'jupiter' | 'mercury' | 'mars' | 'venus';

export const STORY_HOSTS: Record<StoryPlanet, string> = { saturn: 'たこ焼き兄妹', jupiter: '大根カイザー', mercury: 'フリージー', mars: 'ヒポキン', venus: 'ボスG' };
/** KIMORIN⭐︎'s work on each planet, as the script tells it */
const KIMORIN_WORK: Record<StoryPlanet, { title?: string; text?: string }> = {
  saturn: { text: 'うんち。' },
  jupiter: { title: 'プリプリ・ボカン' },
  mercury: { title: 'プリプリ・ボカン' },
  mars: { title: 'プリプリ・ボカン' },
  venus: { title: 'すね毛、すね毛、すね毛楽しい！' },
};
const SATURN_WORDS: Record<string, string> = { MONBAN: '……今日も、異常なし…。', 'MIKIE⭐︎DRILL': 'ようこそ。' };

export interface StoryCastInput {
  neo: string;
  /** the inviter's name ('' / '…': nobody invited → MIKIE⭐︎DRILL) */
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
  const sample = templateSample(planet as HomePlanet, now);
  const kimorin = by(sample, 'KIMORIN⭐︎')!;
  const mikie = by(sample, 'MIKIE⭐︎DRILL')!;
  const monban = by(sample, 'MONBAN')!;
  const k = KIMORIN_WORK[planet];
  const words = (w: HomeWork, name: string) => (planet === 'saturn' && SATURN_WORDS[name] ? { text: SATURN_WORDS[name] } : {});
  if (place !== 'neo') {
    // the resident's place: KIMORIN⭐︎ (pushed), MONBAN (their dachi), and the rest of the sample's residents
    const others = sample.around.filter((w) => !['KIMORIN⭐︎', 'MIKIE⭐︎DRILL', 'MONBAN', 'たこ焼きブラザー', 'たこ焼きシスター'].includes(w.author.name)).filter((w, i, a) => a.findIndex((x) => x.author.name === w.author.name) === i);
    return {
      ...sample,
      owner: { id: `story-host-${planet}`, name: STORY_HOSTS[planet] },
      own: [],
      around: [
        as(kimorin, `st-${planet}-kimorin`, { ...k, rel: 'oshi' }),
        as(monban, `st-${planet}-monban`, { ...words(monban, 'MONBAN'), rel: 'dachi' }),
        ...(planet === 'saturn' ? [as(kimorin, `st-${planet}-kimorin-2`, { ...k, rel: 'oshi' })] : []),
        ...others.slice(0, 4).map((w, i) => as(w, `st-${planet}-r${i}`)),
      ],
      far: [],
    };
  }
  const real = !!o.inviter && o.inviter !== '…' && o.inviter !== 'MIKIE⭐︎DRILL';
  const inviter = real ? as(mikie, `st-${planet}-inviter`, { name: o.inviter!, rel: 'dachi', ...words(mikie, 'MIKIE⭐︎DRILL') }) : as(mikie, `st-${planet}-inviter`, { rel: 'dachi', ...words(mikie, 'MIKIE⭐︎DRILL') });
  // a real inviter has no figure of the sample's: the planet's plain figure with their name (never MIKIE's face)
  if (real) inviter.author = { ...inviter.author, figure: null, ball: null, pic: null };
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
    around: [inviter, as(kimorin, `st-${planet}-kimorin`, { ...k, rel: 'dachi' })],
    far: [],
  };
}
