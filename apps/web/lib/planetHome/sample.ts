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
const FAR = ['はるか', 'ショウタ', 'れい', 'ぽんず', 'kei', 'みお'];
const WORDS = ['明日もがんばるZE', 'うまいラーメン見つけた', 'ねむい…でも楽しい', '新曲できたかも', '空がきれいだった', 'たこ焼き食べたい。', 'きょうは晴れ'];

export function sampleView(
  planet: HomePlanet,
  o: {
    young?: boolean;
    firstTime?: boolean;
    arrivals?: number;
    owner?: string;
    demo?: boolean;
    now?: number;
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
    author: { id: `u-${name}`, name },
    rel,
    text: planet === 'saturn' ? WORDS[i % WORDS.length] : '',
    title: planet === 'saturn' ? undefined : `${name}の${cfg.work}`,
    url: planet === 'saturn' ? `tts:${WORDS[i % WORDS.length]}` : null,
    flownAt: at(h),
    demo: o.demo,
  });
  // the last visit was 12 hours ago: the first `arrivals` came after it
  const around = PEOPLE.filter(([, r]) => !o.young || r === 'dachi').map(([n, r], i) => work(`a${i}`, n, r, i < arrivals ? 1 + i : 14 + i * 9, i));
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
