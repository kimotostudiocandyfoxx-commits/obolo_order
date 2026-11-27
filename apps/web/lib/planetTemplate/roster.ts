import type { HomePlanet } from '@obolo/shared';

/**
 * Who comes to the homes (story M-R341 / M-R342, handoff planets-08 chapter 2; the prototype's ROSTER / DAYPL / RESG /
 * NAMEK). The oshi grow by the residents of each planet visited on the first journey:
 *
 *   day 3 土星   スシモン7体（月で出会う）＋たこ焼きブラザー・たこ焼きシスター   9
 *   day 4 木星   大根カイザー                                                  10
 *   day 5 水星   フリージー                                                    11
 *   day 6 火星   ヒポキン                                                      12
 *   day 7 金星   ボスG・ロングG・ハットG                                        15
 *   day 8 冥王星 クロコパトラ                                                   16
 *   day 9 海王星 オニモンク                                                     17
 *   day 10 天王星 MONBAN                                                       18
 *
 * ダチ are KIMORIN⭐︎ only, and MIKIE⭐︎DRILL after becoming Obolo Order. Nobody else is a character of the homes: the
 * earlier sample people (ユウキ, nana, れい, ショウ, ミオ …) are gone (M-R342). The strangers of the sky are not
 * characters — in production they are other members.
 *
 * `pic` is the key of the story team's art (public/planets/sample/fig-<planet>-<pic>.webp and chibi-<pic>.webp, cut by
 * scripts/planet-home/roster-figures.py): every oshi comes to every planet in that planet's riding figure.
 */
export interface RosterPerson {
  name: string;
  pic: string;
}

export const SUSHIMON: readonly RosterPerson[] = [
  { name: 'サーぽん', pic: 'sapon' },
  { name: 'ガリみ♡', pic: 'gari' },
  { name: 'えびすけ', pic: 'ebi' },
  { name: 'ウニまる', pic: 'uni' },
  { name: 'いかチョロ', pic: 'ika' },
  { name: 'しゃりお', pic: 'shari' },
  { name: 'かにぶぅ', pic: 'kani' },
];

/** the planets in the order they are visited, with the day and the residents met there */
export const ROSTER_DAYS: readonly { day: number; planet: HomePlanet; residents: readonly RosterPerson[] }[] = [
  { day: 3, planet: 'saturn', residents: [{ name: 'たこ焼きブラザー', pic: 'brother' }, { name: 'たこ焼きシスター', pic: 'sister' }] },
  { day: 4, planet: 'jupiter', residents: [{ name: '大根カイザー', pic: 'kaiser' }] },
  { day: 5, planet: 'mercury', residents: [{ name: 'フリージー', pic: 'freezy' }] },
  { day: 6, planet: 'mars', residents: [{ name: 'ヒポキン', pic: 'hipokin' }] },
  { day: 7, planet: 'venus', residents: [{ name: 'ボスG', pic: 'bossg' }, { name: 'ロングG', pic: 'longg' }, { name: 'ハットG', pic: 'hatg' }] },
  { day: 8, planet: 'pluto', residents: [{ name: 'クロコパトラ', pic: 'croco' }] },
  { day: 9, planet: 'neptune', residents: [{ name: 'オニモンク', pic: 'onimonk' }] },
  { day: 10, planet: 'uranus', residents: [{ name: 'MONBAN', pic: 'monban' }] },
];
export const ROSTER_FIRST_DAY = 3;
export const ROSTER_LAST_DAY = 10;

export const KIMORIN: RosterPerson = { name: 'KIMORIN⭐︎', pic: 'kimorin' };
export const MIKIE: RosterPerson = { name: 'MIKIE⭐︎DRILL', pic: 'mikie' };

/** the day a planet is visited on (the day its residents join the oshi) */
export function rosterDayOf(planet: HomePlanet): number {
  return ROSTER_DAYS.find((d) => d.planet === planet)?.day ?? ROSTER_LAST_DAY;
}

/** the residents met by `day` (inclusive), in the order they were met */
export function residentsBy(day: number): RosterPerson[] {
  return ROSTER_DAYS.filter((d) => d.day <= day).flatMap((d) => [...d.residents]);
}

/**
 * The oshi on `day` of the first journey (≥ 10, and after it: all eighteen; before day 3: none), in the order they come
 * around (the prototype's ROSTER: the newest residents first — three of them — then the Sushimon, then the residents met
 * earlier), so the people just met are among the eight on screen and the rest wait their turn.
 */
export function oshiOn(day: number): RosterPerson[] {
  if (day < ROSTER_FIRST_DAY) return [];
  const res = residentsBy(day).reverse();
  return [...res.slice(0, 3), ...SUSHIMON, ...res.slice(3)];
}

/** how many oshi on `day` (the handoff's table: 9, 10, 11, 12, 15, 16, 17, 18) */
export const oshiCount = (day: number): number => oshiOn(day).length;

/** ダチ of the story: KIMORIN⭐︎, and MIKIE⭐︎DRILL once an Obolo Order */
export function dachiOf(ordered: boolean): RosterPerson[] {
  return ordered ? [KIMORIN, MIKIE] : [KIMORIN];
}

/** every name that may appear as a character on a home (M-R342) */
export const HOME_CAST: ReadonlySet<string> = new Set([KIMORIN.name, MIKIE.name, ...SUSHIMON.map((p) => p.name), ...ROSTER_DAYS.flatMap((d) => d.residents.map((p) => p.name))]);
