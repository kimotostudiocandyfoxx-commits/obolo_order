import { PLANET_FIGURES, type FigureWings, type PlanetFigure, type PlanetFigures } from '@obolo/shared';

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
/**
 * M-R325 / M-R326, kept beside each figure:
 *  'f#src'      the painting the figure was cut from (kept from M-R325 on: a later cut-out can cut it again without painting)
 *  'f#cut'      how it was cut: CUT_VERSION (the checked cut), 'r…' (a figure of before, re-cut from its cut PNG and
 *               checked), 'x…:checks' (a figure of before that fails the checks: shown as it is, to be painted again)
 *  'f#cutfail'  a painting whose cut failed every retry and is not shown ("colour:shape|model:area|…"): for the operators
 */
export const srcKey = (f: PlanetFigure) => `${f}#src`;
export const cutKey = (f: PlanetFigure) => `${f}#cut`;
export const cutFailKey = (f: PlanetFigure) => `${f}#cutfail`;
export const CUT_VERSION = '2';
/** the figures of every kept look that were cut before the checked cut (the re-cut backfill) */
export const figuresToRecut = (store: FigureStore | null | undefined): { look: string; figure: PlanetFigure; url: string; src?: string }[] =>
  Object.entries(store ?? {}).flatMap(([look, e]) => PLANET_FIGURES.filter((f) => e[f] && !e[cutKey(f)]).map((f) => ({ look, figure: f, url: e[f], ...(e[srcKey(f)] ? { src: e[srcKey(f)] } : {}) })));

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
/** 03 §1: the measured wing cut of the look's Jupiter figure (null: not measured, could not be, or no figure) */
export function wingsOf(store: FigureStore | null | undefined, look: string | null | undefined): FigureWings | null {
  const e = look ? store?.[look] : undefined;
  return e?.jupiter ? decodeWings(e[WINGS_KEY]) : null;
}
/** the looks whose Jupiter figure is made but its wings were never measured (the backfill) */
export const wingsToMeasure = (store: FigureStore | null | undefined): string[] =>
  Object.entries(store ?? {})
    .filter(([, e]) => e.jupiter && !e[WINGS_KEY])
    .map(([look]) => look);

// --- 03 §1 the Jupiter figure's wing cut (measured in wings.ts) ---------------------------------------------------

/** the cut lies this much (percent of the width) outside the face's edge */
export const WING_MARGIN = 3;
/** a cut is kept only inside these bounds (percent of the width) */
export const WING_BOUNDS = { minL: 5, maxL: 45, minR: 55, maxR: 95, minBody: 20 } as const;
/** a cut that keeps the face in the body and leaves wings on both sides, else null */
export function saneWings(l: number, r: number): FigureWings | null {
  const b = WING_BOUNDS;
  const L = Math.max(b.minL, l);
  const R = Math.min(b.maxR, r);
  if (L > b.maxL || R < b.minR || R - L < b.minBody) return null;
  // the face was clamped away (it reaches past the bounds): the cut would cross it
  if (l < b.minL - WING_MARGIN || r > b.maxR + WING_MARGIN) return null;
  return { l: L, r: R };
}

/** how the cut is kept with the figures (planet_figures[look]['jupiter#wings']): "l,r", or "none" when it could not be measured */
export const WINGS_KEY = 'jupiter#wings';
export const encodeWings = (w: FigureWings | null): string => (w ? `${w.l},${w.r}` : 'none');
export function decodeWings(v: string | null | undefined): FigureWings | null {
  const m = /^(\d{1,2}),(\d{1,2})$/.exec(v ?? '');
  return m ? saneWings(Number(m[1]), Number(m[2])) : null;
}
