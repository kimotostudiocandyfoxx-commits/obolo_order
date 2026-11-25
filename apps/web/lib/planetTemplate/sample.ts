import { PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetHomeView } from '@obolo/shared';

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
    return {
      id: `${planet}-s${i}`,
      kind,
      author: { id: rel === 'own' ? 'me' : `u-${name}`, name, pic: null, figure: planet === 'saturn' ? null : fig, ball: planet === 'saturn' ? fig : null },
      rel,
      text: WORDS[i % WORDS.length],
      title: planet === 'saturn' ? undefined : `${name}の${cfg.work}`,
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
    own: [0, 1, 2, 3].map((i) => work(100 + i, 'ミナト★', 'user', 'own', 30 + i * 40)),
    around: CAST.map(([n, p, r], i) => work(i, n, p, r, 1 + i * 3)),
    far: [],
  };
}
