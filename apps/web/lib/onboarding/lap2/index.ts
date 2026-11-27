import { LAP2 } from '@obolo/shared';
import { AFTER_DAYS } from '../after';
import type { Step } from '../script';

export { MIKIE_DRILL } from './mars';

/**
 * What an Obolo Order of the eight-day journey plays after it (shared LAP2, lap2Applies): the three days after joining
 * (lib/onboarding/after.ts — 天王星, 冥王星, 海王星 + the end), one a day. Since M-R341 everyone else visits the three
 * planets on days 8–10 of the first journey (lib/onboarding/outer.ts) and has no days after joining.
 */
export const LAP2_STEPS: Step[][] = AFTER_DAYS;
if (LAP2_STEPS.length !== LAP2.length) throw new Error('LAP2_STEPS out of step with LAP2');

/** day `chapter` (0-based) after joining */
export function lap2Steps(chapter: number): Step[] {
  return LAP2_STEPS[chapter] ?? [];
}

/**
 * The screens the story asks for ({ t: 'l2', what }; components/lap2/L2Step.tsx). The `m-…` ones are the days after
 * joining (components/after); the others are the old second journey's, kept while their components stay.
 */
export type L2What =
  // after joining (P05m)
  | 'm-goods' | 'm-publish-goods' | 'm-shop' | 'm-shop-locked'
  | 'm-story-seed' | 'm-story-cards' | 'm-story-write' | 'm-picturebook' | 'm-publish-book'
  | 'm-nagare' | 'm-game-seed' | 'm-game-cards' | 'm-game-play' | 'm-publish-game'
  // the old second journey's screens
  | 'ask' | 'relook'
  | 'dachi-rules' | 'invite' | 'plaza' | 'relay' | 'compass-kimorin' | 'compass-song'
  | 'jacket' | 'kimorin-jacket' | 'kimorin-tree' | 'my-tree' | 'tree-deco'
  | 'my-island' | 'kimorin-song2' | 'place-song' | 'theme-island' | 'island-deco' | 'kimorin-island'
  | 'kimorin-ten' | 'theater'
  | 'booth' | 'kimorin-mix'
  | 'novel' | 'kimorin-life' | 'picturebook' | 'library' | 'owl-send' | 'kimorin-owl'
  | 'game'
  | 'round-cards' | 'route' | 'switchboard' | 'comms';
