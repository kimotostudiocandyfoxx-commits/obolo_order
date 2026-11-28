import { PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetHomeView } from '@obolo/shared';
import { castByKey, castWork } from './castWorks';
import { FIVE, isFivePlanet, sampleArtIndex, sampleGoodsKind, sampleOpening } from './five';
import { SAMPLE_ARTS } from './jupiter';
import { SAMPLE_SONGS, sampleSongUrl } from './mercury';
import { dachiOf, oshiOn, ROSTER_LAST_DAY } from './roster';

/**
 * The preview's sample home (/planets-preview/<planet>?sample=1, and when the app runs without the API): the story's
 * cast with their figures on every planet (the story team's pictures, public/planets/sample/). Names and pictures are
 * the prototype's; nothing is written.
 *
 * M-R341 / M-R342 (handoff planets-08): only the story's cast comes — the ダチ KIMORIN⭐︎ (and MIKIE⭐︎DRILL once an Obolo
 * Order) and the oshi of the day (lib/planetTemplate/roster.ts: 9 on day 3 … 18 on day 10). The sample people of before
 * (ユウキ, nana, れい, ショウ, ミオ) are gone. Without a day: the journey done as an Obolo Order (both ダチ, all 18 oshi).
 *
 * M-R344 (handoff planets-08 chapters 3 and 6): the cast bring their REAL works — one each per planet, the story
 * team's words, pictures and voices (lib/planetTemplate/castWorks.ts) — not sample works. A cast member without works
 * (MIKIE⭐︎DRILL: the story has made none yet) does not come. Only the preview's own 「you」 (ミナト★) still carries
 * the prototype's sample works, so the preview's own place and profile have something in them.
 */
export interface SampleCast {
  /** the first journey's day whose roster comes (3–10); none: all eighteen */
  day?: number;
  /** an Obolo Order: MIKIE⭐︎DRILL is a ダチ too (default: true without a day, false with one) */
  ordered?: boolean;
}
export function sampleCast(o: SampleCast = {}): [name: string, pic: string, rel: HomeRel][] {
  const ordered = o.ordered ?? o.day === undefined;
  // MIKIE⭐︎DRILL first when she is there (the newest arrival, as the sample always had her)
  return [...dachiOf(ordered).reverse().map((p): [string, string, HomeRel] => [p.name, p.pic, 'dachi']), ...oshiOn(o.day ?? ROSTER_LAST_DAY).map((p): [string, string, HomeRel] => [p.name, p.pic, 'oshi'])];
}
const WORDS = ['明日もがんばるZE', 'うまいラーメン見つけた', 'ねむい…でも楽しい', '新曲できたかも', '空がきれいだった', 'たこ焼き食べたい。', 'きょうは晴れ'];
export const SAMPLE_OWN_FIGURE = (planet: HomePlanet) => `/planets/sample/fig-${planet}-user.webp`;

/** one of the prototype's sample works (the preview's own 「you」, and the story's stand-in for an inviter's work) */
export function sampleWork(planet: HomePlanet, i: number, name: string, pic: string, rel: HomeRel, flownAt: string): HomeWork {
  const cfg = PLANET_HOMES[planet];
  const kind = cfg.store ?? 'saturn_post';
  {
    const fig = `/planets/sample/fig-${planet}-${pic}.webp`;
    const art = `/planets/sample/art-${(i % 5) + 1}.webp`;
    if (planet === 'mercury') {
      // 02: the prototype's five songs (popSh's ji: its picture is the jacket printed over the disc)
      const k = ((i * 2 + [...name].length) % 5) + 1;
      return { id: `mercury-s${i}`, kind, author: { id: rel === 'own' ? 'me' : `u-${name}`, name, pic: null, figure: fig }, rel, text: '', title: SAMPLE_SONGS[k - 1], url: sampleSongUrl(k), thumbUrl: `/planets/sample/art-${k}.webp`, flownAt, demo: true };
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
        flownAt,
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
      flownAt,
      demo: true,
    };
  }
}

export function templateSample(planet: HomePlanet, now = Date.now(), cast: SampleCast = {}): PlanetHomeView {
  const CAST = sampleCast(cast);
  const at = (h: number) => new Date(now - h * 3600_000).toISOString();
  const work = (i: number, name: string, pic: string, rel: HomeRel, h: number) => sampleWork(planet, i, name, pic, rel, at(h));
  return {
    planet,
    live: true,
    owner: { id: 'me', name: 'ミナト★' },
    young: false,
    lastVisitAt: at(12),
    // Mercury: your eight records on the beach, and each friend's past songs (the prototype's profile)
    // 05: ten of yours on the shelf, and 5–8 of each friend's (the prototype's openProf: ME 10, others 5 + name.length % 4)
    own: Array.from({ length: planet === 'mercury' ? 8 : isFivePlanet(planet) ? 10 : 4 }, (_, i) => work(100 + i, 'ミナト★', 'user', 'own', 30 + i * 40)),
    // M-R344: each of the cast with their one real work of this planet (nobody without works)
    around: CAST.flatMap(([, p, r], i) => {
      const c = castByKey(p);
      return c ? [castWork(planet, c, r, at(1 + i * 3))] : [];
    }),
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
