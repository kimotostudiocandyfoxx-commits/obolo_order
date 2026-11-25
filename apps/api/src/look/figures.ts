import { PLANET_FIGURES, type PlanetFigure, type PlanetFigures } from '@obolo/shared';

/** paintings per figure per look in one job (one + one retry, like the Saturn mini figure M-R262) */
export const FIGURE_RUN_TRIES = 2;
/** paintings per figure per look in all: what a job could not make, the backfill tries once more, then never again */
export const FIGURE_TRIES = 3;
/** figures painted at once for one look (a small burst: Runware refuses a big one, the look's own pictures may be running) */
export const FIGURE_CONCURRENCY = 3;
/** the stored figure's side (a transparent PNG, like the mini figure) */
export const FIGURE_SIDE = 768;

/** a member's figures per look: look URL → { figure → URL, 'figure#tries' → n } */
export type FigureStore = Record<string, Record<string, string>>;
export const triesKey = (f: PlanetFigure) => `${f}#tries`;

/** the figures of one look, without the counters */
export function figuresOf(store: FigureStore | null | undefined, look: string | null | undefined): PlanetFigures {
  const e = look ? store?.[look] : undefined;
  if (!e) return {};
  const out: PlanetFigures = {};
  for (const f of PLANET_FIGURES) if (e[f]) out[f] = e[f];
  return out;
}
/** the figures of `look` still to paint (not made, tries left) */
export function figuresToMake(store: FigureStore | null | undefined, look: string): PlanetFigure[] {
  const e = store?.[look] ?? {};
  return PLANET_FIGURES.filter((f) => !e[f] && Number(e[triesKey(f)] ?? 0) < FIGURE_TRIES);
}
