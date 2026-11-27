import { PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetHomeView } from '@obolo/shared';
import { FIVE, isFivePlanet, sampleArtIndex, sampleGoodsKind, sampleOpening } from './five';
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
    if (isFivePlanet(planet)) {
      // 05: the prototype's five works of each planet (G5[pl].titles) on its five pictures; Mars's MV plays the
      // prototype's song over its picture, Pluto's book opens on the prototype's first lines
      const k = sampleArtIndex(i, name);
      // story 2026-11-25: Uranus shows each of the six kinds (its words are the kind, as the API's); Neptune's cases are
      // half a member's art, half the neon face (no cover chosen)
      const g = planet === 'uranus' ? (i + k) % 6 : -1;
      return {
        id: `${planet}-s${i}`,
        kind,
        author: { id: rel === 'own' ? 'me' : `u-${name}`, name, pic: null, figure: fig },
        rel,
        text: planet === 'pluto' ? sampleOpening(name) : planet === 'neptune' ? 'タップで遊べるよ' : planet === 'uranus' ? sampleGoodsKind(g) : '',
        title: g >= 0 ? FIVE.uranus.titles[g] : FIVE[planet].titles[k - 1],
        url: planet === 'mars' ? sampleSongUrl(k) : null,
        thumbUrl: planet === 'neptune' && (i + k) % 2 === 1 ? null : `/planets/sample/art-${k}.webp`,
        flownAt: at(h),
        demo: true,
      };
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
    // 05: ten of yours on the shelf, and 5–8 of each friend's (the prototype's openProf: ME 10, others 5 + name.length % 4)
    own: Array.from({ length: planet === 'mercury' ? 8 : isFivePlanet(planet) ? 10 : 4 }, (_, i) => work(100 + i, 'ミナト★', 'user', 'own', 30 + i * 40)),
    around: [
      ...CAST.map(([n, p, r], i) => work(i, n, p, r, 1 + i * 3)),
      ...(planet === 'mercury' ? CAST.flatMap(([n, p, r], i) => Array.from({ length: 3 + ([...n].length % 3) }, (_, j) => work(20 + i * 10 + j, n, p, r, 40 + i * 3 + j))) : []),
      ...(isFivePlanet(planet) ? CAST.flatMap(([n, p, r], i) => Array.from({ length: 4 + ([...n].length % 4) }, (_, j) => work(20 + i * 10 + j, n, p, r, 40 + i * 3 + j))) : []),
    ],
    far: [],
  };
}

/**
 * Story 2026-11-27 (B7): what a home shows for the feed it got. The preview (`emptyAsSample`) falls back to the sample
 * cast whenever there is nothing real to show; a live planet route never does for a signed-in member's own feed — an
 * empty feed is their own place with no visitors ('empty'). The in-browser demo (a feed that is not live) keeps the
 * sample: there is no member behind it.
 */
export function liveHomeShows(view: PlanetHomeView | null, emptyAsSample: boolean): 'real' | 'empty' | 'sample' {
  const has = !!view && view.live && (view.around.length > 0 || view.own.length > 0);
  if (has) return 'real';
  if (emptyAsSample) return 'sample';
  if (view && !view.live) return 'sample';
  return 'empty';
}

/** a member's own place with nothing flown and nobody around */
export function emptyHome(planet: HomePlanet, id: string, name: string, now = Date.now()): PlanetHomeView {
  return { planet, live: true, owner: { id, name }, young: false, lastVisitAt: new Date(now).toISOString(), own: [], around: [], far: [] };
}
