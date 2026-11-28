import { JOURNEY_LAST_DAY, PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetHomeView, type PlanetSongView } from '@obolo/shared';
import data from './castWorks.json';
import { dachiOf, KIMORIN, MIKIE, oshiOn, ROSTER_FIRST_DAY, ROSTER_LAST_DAY, type RosterPerson } from './roster';

/**
 * The works of the homes' cast on all eight planets (story M-R344, handoff planets-08 chapters 3 and 6): the seven
 * Sushimon, the eleven residents and KIMORIN⭐︎ each have ONE work per planet — a Saturn line in their own voice, a
 * Jupiter art whose title they read, a Mercury song with its lyrics, a Mars MV, a Venus radio show, a Uranus goods
 * item they announce, a Pluto picture book they read page by page and a Neptune tap game. Nothing here is a sample:
 * the words are the story team's (castWorks.json — copied by scripts/planet-home/cast-works.py, never reworded) and
 * the sound and pictures are theirs (public/planets/cast/<key>/, the M-R344 voices).
 *
 * The cast are characters, not members: their works are not rows of any store. A home shows them as HomeWork items
 * (`demo`: no 〔推す〕〔外す〕〔通報〕, nothing is asked of the API) whose id says whose and where: `cast-<key>-<planet>`.
 * MIKIE⭐︎DRILL's works came with the story's f66e3a1e (res.json `mikie`): she is a ダチ ONLY once the member is an Obolo
 * Order (M-R342 / M-R343 — `orderedAt` set, the same rule as the server's MIKIE ダチ thread); before that she never comes.
 */
export type CastGameKind = 'wobble' | 'puff' | 'jump' | 'spin' | 'ink' | 'scatter' | 'snap';
export interface CastWorks {
  key: string;
  group: 'sushimon' | 'resident' | 'dachi';
  name: string;
  /** Saturn: the line blown in */
  saturn: string;
  /** Jupiter: the art's title */
  art: string;
  /** Mercury / Mars: the song's title, and its words with the second each starts on */
  song: string;
  lyrics: [number, string][];
  genre: string | null;
  bpm: number | null;
  /** Venus: the show's title */
  radio: string;
  /** Uranus: the goods' name */
  goods: string;
  /** Pluto: the picture book's title and its pages (6 for a Sushimon, 3 for the others) */
  book: string;
  pages: string[];
  /** Neptune: the game's name and what a tap does */
  game: string;
  gameKind: CastGameKind;
  /** the Sushimon have a jacket, a radio picture and a looping MV of their own; the others use their Jupiter art */
  hasJacket: boolean;
  hasRadioPic: boolean;
  hasMv: boolean;
  /** Neptune: a flat anime picture of their own to tap (the Sushimon, cut from their reference picture); else their chibi */
  hasGamePic?: boolean;
}

export const CAST_WORKS: readonly CastWorks[] = data as CastWorks[];
const BY_KEY = new Map(CAST_WORKS.map((c) => [c.key, c]));
const BY_NAME = new Map(CAST_WORKS.map((c) => [c.name, c]));

export const castByKey = (key: string): CastWorks | undefined => BY_KEY.get(key);
/** the cast member of this name who has works */
export const castByName = (name: string): CastWorks | undefined => BY_NAME.get(name);

/** a file of a cast member's works (public/planets/cast/<key>/) */
export const castAsset = (key: string, file: string) => `/planets/cast/${key}/${file}`;

const ID = /^cast-([a-z]+)-([a-z]+)$/;
export const castAuthorId = (key: string) => `cast-${key}`;
export const castWorkId = (key: string, planet: HomePlanet) => `cast-${key}-${planet}`;
/** is this person one of the cast (never asked of the API) */
export const isCastPerson = (id: string | null | undefined): boolean => !!id && id.startsWith('cast-') && BY_KEY.has(id.slice(5));

/** whose work this is, when it is one of the cast's */
export function castOfWork(w: Pick<HomeWork, 'id'> | null | undefined): { cast: CastWorks; planet: HomePlanet } | null {
  const m = ID.exec(w?.id ?? '');
  const cast = m ? BY_KEY.get(m[1]) : undefined;
  return cast && m && m[2] in PLANET_HOMES ? { cast, planet: m[2] as HomePlanet } : null;
}

/** the picture a cast member's work shows on `planet` */
export function castPicture(c: CastWorks, planet: HomePlanet): string | null {
  switch (planet) {
    case 'saturn':
      return null;
    case 'mercury':
      return castAsset(c.key, c.hasJacket ? 'jacket.webp' : 'art.webp');
    case 'venus':
      return castAsset(c.key, c.hasRadioPic ? 'radio.webp' : 'art.webp');
    case 'uranus':
      return castAsset(c.key, 'goods.webp');
    case 'pluto':
      return castAsset(c.key, 'book-1.webp');
    case 'neptune':
      return castGamePicture(c);
    default:
      return castAsset(c.key, 'art.webp');
  }
}
/**
 * Neptune: who is tapped in the game. The seven Sushimon: their flat anime picture cut from the reference picture
 * (story 2026-11-28: never the 3D jumping chibi). The residents and KIMORIN⭐︎: their chibi (handoff 08 §6).
 */
export const castGamePicture = (c: CastWorks) => (c.hasGamePic ? castAsset(c.key, 'game.webp') : `/planets/sample/chibi-${c.key}.webp`);

/** the voice that starts with the tap (handoff 08 §3: 「声は、タップの瞬間に鳴らす」): Jupiter the title, Uranus the goods' line, Pluto the book's title, Neptune the game's name */
export function castTapVoice(c: CastWorks, planet: HomePlanet): string | null {
  if (planet === 'jupiter') return castAsset(c.key, 'dadv.mp3');
  if (planet === 'uranus') return castAsset(c.key, 'goodsv.mp3');
  if (planet === 'pluto') return castAsset(c.key, 'bookv.mp3');
  if (planet === 'neptune') return castAsset(c.key, 'gamev.mp3');
  return null;
}

/** a cast member's figure on `planet` (the story team's art, scripts/planet-home/roster-figures.py) */
const figureOf = (planet: HomePlanet, pic: string) => `/planets/sample/fig-${planet}-${pic}.webp`;

/** one cast member's work on `planet`, as a home shows it */
export function castWork(planet: HomePlanet, c: CastWorks, rel: HomeRel, flownAt: string): HomeWork {
  const kind = PLANET_HOMES[planet].store ?? 'saturn_post';
  const fig = figureOf(planet, c.key);
  const author: HomeWork['author'] = planet === 'saturn' ? { id: castAuthorId(c.key), name: c.name, pic: null, figure: `/planets/sample/chibi-${c.key}.webp`, ball: fig } : { id: castAuthorId(c.key), name: c.name, pic: null, figure: fig };
  const base = { id: castWorkId(c.key, planet), kind, author, rel, flownAt, demo: true, thumbUrl: castPicture(c, planet) } as const;
  switch (planet) {
    case 'saturn':
      return { ...base, text: c.saturn, url: castAsset(c.key, 'saturn.mp3') };
    case 'jupiter':
      return { ...base, text: '', title: c.art, url: castAsset(c.key, 'art.webp') };
    case 'mercury':
      return { ...base, text: '', title: c.song, url: castAsset(c.key, 'song.mp3') };
    case 'mars':
      // the Sushimon's MV loops without sound under their song; the others' is their art moving slowly under the song
      return { ...base, text: '', title: c.song, url: castAsset(c.key, 'song.mp3') };
    case 'venus':
      return { ...base, text: '', title: c.radio, url: castAsset(c.key, 'radiov.mp3') };
    case 'uranus':
      return { ...base, text: '', title: c.goods, url: null };
    case 'pluto':
      return { ...base, text: c.pages[0] ?? '', title: c.book, url: null };
    case 'neptune':
      return { ...base, text: '', title: c.game, url: null };
  }
}

/** Mars: the looping film under the song (the Sushimon only) */
export const castMv = (c: CastWorks): string | null => (c.hasMv ? castAsset(c.key, 'mv.mp4') : null);

/** Mercury: a cast member's song the Mercury way — the sound, the jacket, the title in their voice, the words in time */
export function castSong(w: Pick<HomeWork, 'id'>): PlanetSongView | null {
  const m = castOfWork(w);
  if (!m) return null;
  const c = m.cast;
  const lyrics = c.lyrics.map(([t, text], i) => ({ t, end: c.lyrics[i + 1]?.[0], text }));
  return { kind: 'planet_post', id: w.id, title: c.song, url: castAsset(c.key, 'song.mp3'), art: castPicture(c, 'mercury'), seconds: null, titleVoice: castAsset(c.key, 'stitle.mp3'), lyrics };
}

// --- who comes ---------------------------------------------------------------------------------------------------

export interface CastDay {
  /** the first journey's day whose roster comes (3–10; ≥ 10: all eighteen; < 3: nobody) */
  day: number;
  /** an Obolo Order (MIKIE⭐︎DRILL is a ダチ then, alongside KIMORIN⭐︎; never before) */
  ordered: boolean;
}

/**
 * M-R342 / M-R343: is this member an Obolo Order — joined once (`orderedAt`), as the server's MIKIE ダチ thread rule reads
 * it (dachi-voice.service mikieThreadShown: `!!u.orderedAt`). A lapsed subscription keeps her a ダチ; nobody: no.
 */
export const isOrderedMember = (me: { orderedAt?: string | null } | null | undefined): boolean => !!me?.orderedAt;


/**
 * The day of the roster a member is on (M-R341): the residents of every planet whose day they have FINISHED — the
 * day they are playing counts once it is done (`journeyCompletedAt`). After the journey (day 11 on): everyone.
 * KIMORIN⭐︎ is met on day 2 (the Moon); from the first planet day he comes as the ダチ.
 */
export function rosterDayOfMember(me: { journeyDay: number; journeyCompletedAt: string | null } | null | undefined): number {
  if (!me) return 0;
  if (me.journeyDay > JOURNEY_LAST_DAY) return ROSTER_LAST_DAY;
  return me.journeyCompletedAt ? me.journeyDay : me.journeyDay - 1;
}

/** the cast who come to a member's real home: the roster day they reached and whether they are an Obolo Order */
export function castDayOfMember(me: { journeyDay: number; journeyCompletedAt: string | null; orderedAt?: string | null }): CastDay {
  return { day: rosterDayOfMember(me), ordered: isOrderedMember(me) };
}

/** the cast who come on that day, in the order they come around: the ダチ first, then the day's oshi (roster.ts) */
export function castOn(o: CastDay): { person: RosterPerson; rel: HomeRel; cast: CastWorks }[] {
  if (o.day < ROSTER_FIRST_DAY) return [];
  const dachi = dachiOf(o.ordered).map((p) => ({ person: p, rel: 'dachi' as HomeRel }));
  const oshi = oshiOn(o.day).map((p) => ({ person: p, rel: 'oshi' as HomeRel }));
  return [...dachi, ...oshi].flatMap((x) => {
    const cast = BY_KEY.get(x.person.pic);
    return cast ? [{ ...x, cast }] : [];
  });
}

/** the cast's works on `planet` that day, newest first from `before` (one minute apart, in the order they come around) */
export function castAround(planet: HomePlanet, o: CastDay, before = Date.now()): HomeWork[] {
  return castOn(o).map((x, i) => castWork(planet, x.cast, x.rel, new Date(before - (i + 1) * 60_000).toISOString()));
}

/**
 * A member's real feed with the cast in it (the live planet routes, the switch on): the real ダチ・推し keep their
 * place — their works first, as they were — and the cast come after them (their works dated just before the oldest
 * real one, so the order on screen is: real people, KIMORIN⭐︎ (and MIKIE⭐︎DRILL for an Obolo Order), the day's oshi). A member a cast member shares a name
 * with is left alone (ids differ). The far scenery (real strangers) is untouched.
 */
export function withCast(view: PlanetHomeView, o: CastDay, now = Date.now()): PlanetHomeView {
  const oldest = view.around.reduce((t, w) => Math.min(t, Date.parse(w.flownAt) || t), now);
  const cast = castAround(view.planet, o, oldest);
  return cast.length ? { ...view, live: true, around: [...view.around, ...cast] } : view;
}

/** the names of the cast who have works (for the tests and the inventory) */
export const CAST_WITH_WORKS: ReadonlySet<string> = new Set(CAST_WORKS.map((c) => c.name));
/** in the roster but without works yet */
export const CAST_WITHOUT_WORKS: readonly string[] = [KIMORIN, MIKIE].map((p) => p.name).filter((n) => !BY_NAME.has(n));

/**
 * ▶ (story 2026-11-28): a cast member's picture book is read to its last page — then it closes, flies away, and the next
 * work comes. No 5.2 s cut for a book; every other work keeps the planet's own time.
 */
export const castReadsToEnd = (w: Pick<HomeWork, 'id'> | null | undefined): boolean => castOfWork(w)?.planet === 'pluto';
