import { PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetHomeView } from '@obolo/shared';
import { SAMPLE_ARTS } from './jupiter';
import { SAMPLE_SONGS, sampleSongUrl } from './mercury';

/**
 * The preview's sample home (/planets-preview/<planet>?sample=1, and when the app runs without the API): the story
 * team's cast with their figures on every planet (the prototype's pictures, public/planets/sample/), ten people so the
 * queue shows. Names and pictures are the prototype's; nothing is written.
 */
const CAST: [name: string, pic: string, rel: HomeRel][] = [
  ['MIKIE⭐︎DRILL', 'mikie', 'dachi'],
  ['KIMORIN⭐︎', 'kimorin', 'dachi'],
  ['MONBAN', 'monban', 'dachi'],
  ['たこ焼きブラザー', 'brother', 'oshi'],
  ['たこ焼きシスター', 'sister', 'dachi'],
  ['ユウキ', 'kimorin', 'dachi'],
  ['nana', 'sister', 'oshi'],
  ['れい', 'monban', 'oshi'],
  ['ショウ', 'brother', 'dachi'],
  ['ミオ', 'mikie', 'oshi'],
];
const WORDS = ['明日もがんばるZE', 'うまいラーメン見つけた', 'ねむい…でも楽しい', '新曲できたかも', '空がきれいだった', 'たこ焼き食べたい。', 'きょうは晴れ'];
export const SAMPLE_OWN_FIGURE = (planet: HomePlanet) => `/planets/sample/fig-${planet}-user.webp`;

export function templateSample(planet: HomePlanet, now = Date.now()): PlanetHomeView {
  const cfg = PLANET_HOMES[planet];
  const kind = cfg.store ?? 'saturn_post';
  const at = (h: number) => new Date(now - h * 3600_000).toISOString();
  const work = (i: number, name: string, pic: string, rel: HomeRel, h: number): HomeWork => {
    const fig = `/planets/sample/fig-${planet}-${pic}.webp`;
    const art = `/planets/sample/art-${(i % 5) + 1}.webp`;
    if (planet === 'mercury') {
      // 02: the prototype's five songs (popSh's ji: its picture is the jacket printed over the disc)
      const k = ((i * 2 + [...name].length) % 5) + 1;
      return { id: `mercury-s${i}`, kind, author: { id: rel === 'own' ? 'me' : `u-${name}`, name, pic: null, figure: fig }, rel, text: '', title: SAMPLE_SONGS[k - 1], url: sampleSongUrl(k), thumbUrl: `/planets/sample/art-${k}.webp`, flownAt: at(h), demo: true };
    }
    return {
      id: `${planet}-s${i}`,
      kind,
      author: { id: rel === 'own' ? 'me' : `u-${name}`, name, pic: null, figure: planet === 'saturn' ? `/planets/sample/chibi-${pic}.webp` : fig, ball: planet === 'saturn' ? fig : null },
      rel,
      text: WORDS[i % WORDS.length],
      // 03 Jupiter: the prototype's five arts and their titles (never 「〜のアート」, M-R310)
      title: planet === 'saturn' ? undefined : planet === 'jupiter' ? SAMPLE_ARTS[i % 5] : `${name}の${cfg.work}`,
      url: planet === 'jupiter' ? art : null,
      thumbUrl: planet === 'saturn' ? null : art,
      flownAt: at(h),
      demo: true,
    };
  };
  return {
    planet,
    live: true,
    owner: { id: 'me', name: 'ミナト★' },
    young: false,
    lastVisitAt: at(12),
    // Mercury: your eight records on the beach, and each friend's past songs (the prototype's profile)
    own: Array.from({ length: planet === 'mercury' ? 8 : 4 }, (_, i) => work(100 + i, 'ミナト★', 'user', 'own', 30 + i * 40)),
    around: [
      ...CAST.map(([n, p, r], i) => work(i, n, p, r, 1 + i * 3)),
      ...(planet === 'mercury' ? CAST.flatMap(([n, p, r], i) => Array.from({ length: 3 + ([...n].length % 3) }, (_, j) => work(20 + i * 10 + j, n, p, r, 40 + i * 3 + j))) : []),
    ],
    far: [],
  };
}
