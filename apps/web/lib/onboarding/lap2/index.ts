import { LAP2 } from '@obolo/shared';
import type { Step } from '../script';
import { resumeSteps } from './common';
import { L2_EARTH } from './earth';
import { L2_JUPITER } from './jupiter';
import { L2_MARS } from './mars';
import { L2_MERCURY } from './mercury';
import { L2_HOME, L2_NEPTUNE, L2_NIGHT, L2_ROOM, L2_URANUS } from './outer';
import { L2_SATURN } from './saturn';
import { L2_VENUS } from './venus';

export { MIKIE_DRILL } from './mars';

/** the second journey's chapters, in the order of shared LAP2 */
export const LAP2_STEPS: Step[][] = [L2_EARTH, L2_SATURN, L2_JUPITER, L2_MERCURY, L2_MARS, L2_VENUS, L2_URANUS, L2_NEPTUNE, L2_HOME, L2_NIGHT, L2_ROOM];
if (LAP2_STEPS.length !== LAP2.length) throw new Error('LAP2_STEPS out of step with LAP2');

/** a chapter as played: after 〔今日はここまで〕 it opens with the same choice (`resumed`); straight on from 〔…へ向かう〕 it does not */
export function lap2Steps(chapter: number, resumed: boolean): Step[] {
  return [...(resumed ? resumeSteps(chapter) : []), ...(LAP2_STEPS[chapter] ?? [])];
}

/** the l2 screens the chapters ask for ({ t: 'l2', what }) */
export type L2What =
  | 'ask' | 'relook'
  | 'dachi-rules' | 'invite' | 'plaza' | 'relay'
  | 'jacket' | 'kimorin-jacket' | 'kimorin-tree' | 'my-tree' | 'tree-deco'
  | 'my-island' | 'kimorin-song2' | 'place-song' | 'theme-island' | 'island-deco' | 'kimorin-island'
  | 'kimorin-ten' | 'theater'
  | 'booth' | 'kimorin-mix'
  | 'goods' | 'kimorin-mug' | 'shop'
  | 'game'
  | 'round-cards' | 'route' | 'switchboard' | 'comms';
