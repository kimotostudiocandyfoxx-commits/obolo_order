import { HOME_PLANETS, PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetHomeView } from '@obolo/shared';

/**
 * Sample views for 星のホーム (the lab page /lab/planet-home and the story's scripted places). The names are the story
 * team's prototype's (design/home/template.html). A story builds its resident's place the same way (owner = the
 * resident, `demo: true` on every work so it carries no menu) and passes the inviter's / KIMORIN's works as `seeds`.
 */
const PEOPLE: [string, HomeRel][] = [
  ['MIKIE⭐︎DRILL', 'dachi'],
  ['KIMORIN⭐︎', 'dachi'],
  ['ユウキ', 'dachi'],
  ['たこ焼きシスター', 'oshi'],
  ['nana', 'oshi'],
  ['ミオ', 'oshi'],
  ['ショウ', 'dachi'],
];
const CAST_CHIBI: Record<string, string> = { own: '/planet-home/chibi-user.webp', 'MIKIE⭐︎DRILL': '/planet-home/chibi-mikie.webp', 'KIMORIN⭐︎': '/planet-home/chibi-kimorin.webp' };
const FAR = ['はるか', 'ショウタ', 'れい', 'ぽんず', 'kei', 'みお'];
const WORDS = ['明日もがんばるZE', 'うまいラーメン見つけた', 'ねむい…でも楽しい', '新曲できたかも', '空がきれいだった', 'たこ焼き食べたい。', 'きょうは晴れ'];

const VOICE_MP3 = ['100noso6h92fo', '10149vuhvw91k', '1022gz118mxxnh', '102og5kogbg1c', '103h34a17mrfxs'].map((n) => `/story/voices/lines/${n}.mp3`);

export function sampleView(
  planet: HomePlanet,
  o: {
    young?: boolean;
    firstTime?: boolean;
    arrivals?: number;
    owner?: string;
    demo?: boolean;
    now?: number;
    /** M-R267's check: this many more kororins from more people (the record holds 16, the rest wait in line) */
    crowd?: number;
    /** M-R275's check: real recorded voices (mp3s from the story's voice lines) instead of read-aloud words */
    voices?: boolean;
  } = {},
): PlanetHomeView {
  const now = o.now ?? Date.now();
  const cfg = PLANET_HOMES[planet];
  const kind = cfg.store ?? 'saturn_post';
  const at = (h: number) => new Date(now - h * 3600_000).toISOString();
  const arrivals = o.arrivals ?? 2;
  const work = (id: string, name: string, rel: HomeRel, h: number, i: number): HomeWork => ({
    id: `${planet}-${id}`,
    kind,
    // the story cast's mini figures stand in where there is one (M-R262); the others show the round face
    // M-R275: everyone's chosen kororin picture (two have not chosen: theirs comes from the ball and the name)
    author: { id: `u-${name}`, name, chibi: CAST_CHIBI[rel === 'own' ? 'own' : name] ?? null, kororin: name === 'ショウ' || name === 'nana' ? null : { pic: ([...name].reduce((a, c) => a + c.codePointAt(0)!, 0) % 24) + 1 } },
    rel,
    text: planet === 'saturn' ? WORDS[i % WORDS.length] : '',
    title: planet === 'saturn' ? undefined : `${name}の${cfg.work}`,
    url: planet === 'saturn' ? (o.voices ? VOICE_MP3[i % VOICE_MP3.length] : `tts:${WORDS[i % WORDS.length]}`) : null,
    flownAt: at(h),
    demo: o.demo,
  });
  // the last visit was 12 hours ago: the first `arrivals` came after it
  const around = PEOPLE.filter(([, r]) => !o.young || r === 'dachi').map(([n, r], i) => work(`a${i}`, n, r, i < arrivals ? 1 + i : 14 + i * 9, i));
  for (let i = 0; i < (o.crowd ?? 0); i++) around.push(work(`c${i}`, `${FAR[i % FAR.length]}${Math.floor(i / FAR.length) + 1}`, i % 3 ? 'dachi' : 'oshi', 1 + i * 0.1, i));
  return {
    planet,
    live: true,
    owner: { id: 'me', name: o.owner ?? 'ミナト★' },
    young: !!o.young,
    lastVisitAt: o.firstTime ? null : at(12),
    own: [0, 1, 2, 3, 4, 5].map((i) => work(`o${i}`, o.owner ?? 'ミナト★', 'own', 30 + i * 70, i + 2)),
    around,
    far: o.young || !cfg.far ? [] : FAR.map((n, i) => work(`f${i}`, n, 'stranger', 3 + i * 5, i)),
  };
}

export const SAMPLE_PLANETS = HOME_PLANETS;
