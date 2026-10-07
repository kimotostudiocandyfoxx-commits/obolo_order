/**
 * Planet registry — the single list of planets used by the home map, routes and API.
 * Spec §2 (planet map). Home layout (client decision 2026-10-03): Earth in the centre,
 * Moon at 12 o'clock, then clockwise Saturn → Jupiter → Mercury → Venus → Mars → Uranus → Neptune.
 */
export type PlanetId =
  | 'earth'
  | 'moon'
  | 'saturn'
  | 'jupiter'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'uranus'
  | 'neptune';

/** "live" = really works in the 10/10 demo, "mock" = visual only with sample data. */
export type DemoStatus = 'live' | 'mock';

export interface PlanetMeta {
  id: PlanetId;
  emoji: string;
  route: `/${PlanetId}`;
  /** Two colours used for the CSS-rendered planet sphere (highlight → shadow). */
  colors: [string, string];
  /** Relative size on the home map (1 = Earth). */
  size: number;
  ring?: boolean;
  demo: DemoStatus;
}

export const PLANETS: Record<PlanetId, PlanetMeta> = {
  earth: { id: 'earth', emoji: '🌍', route: '/earth', colors: ['#7fd3ff', '#1d4fa8'], size: 1, demo: 'live' },
  moon: { id: 'moon', emoji: '🌙', route: '/moon', colors: ['#fdfbf2', '#9b9a94'], size: 0.62, demo: 'live' },
  saturn: { id: 'saturn', emoji: '🪐', route: '/saturn', colors: ['#f6e3b4', '#b88a4a'], size: 0.78, ring: true, demo: 'live' },
  jupiter: { id: 'jupiter', emoji: '🟤', route: '/jupiter', colors: ['#f0c9a0', '#8a5530'], size: 0.86, demo: 'live' },
  mercury: { id: 'mercury', emoji: '💧', route: '/mercury', colors: ['#c9f1ff', '#3d8fb8'], size: 0.62, demo: 'mock' },
  venus: { id: 'venus', emoji: '🟡', route: '/venus', colors: ['#fff3a8', '#d1a316'], size: 0.72, demo: 'mock' },
  mars: { id: 'mars', emoji: '🔥', route: '/mars', colors: ['#ffb38a', '#b8341b'], size: 0.66, demo: 'mock' },
  uranus: { id: 'uranus', emoji: '⭕', route: '/uranus', colors: ['#d4fbff', '#4fb4c0'], size: 0.74, demo: 'mock' },
  neptune: { id: 'neptune', emoji: '🔵', route: '/neptune', colors: ['#a9c4ff', '#2836a8'], size: 0.74, demo: 'mock' },
};

/** Orbit order on the home map: index 0 sits at 12 o'clock, then clockwise. */
export const ORBIT_ORDER: readonly PlanetId[] = [
  'moon',
  'saturn',
  'jupiter',
  'mercury',
  'venus',
  'mars',
  'uranus',
  'neptune',
] as const;

export const ALL_PLANETS: readonly PlanetId[] = ['earth', ...ORBIT_ORDER];

export function isPlanetId(v: string): v is PlanetId {
  return (ALL_PLANETS as readonly string[]).includes(v);
}
