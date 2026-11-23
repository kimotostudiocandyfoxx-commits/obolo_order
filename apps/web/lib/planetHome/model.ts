import { dropPlan, homeHoursLeft, isNewSince, type HomeWork, type PlanetHomeView } from '@obolo/shared';

/**
 * 星のホーム (M-R258): what is on the screen, worked out from the feed (or from a story's scripted view) — no drawing
 * here, so the look can be swapped without touching the rules. See components/planetHome/PlanetHome.tsx.
 */
export type StageItem = HomeWork & {
  /** came since the last visit: sparkles a little (never counted) */
  fresh: boolean;
  /** falls in when the screen opens: one by one, or inside the one 「＋」 */
  drop: 'one' | 'plus' | null;
  /** a dachi's / 推し's work whose 88 hours ran out while the screen is open: leaves the planet's way */
  leaving: boolean;
};

export interface Stage {
  own: StageItem[];
  around: StageItem[];
  far: StageItem[];
  /** something falls in the 「＋」 (more than five new) */
  plus: boolean;
  /** the first time here: the one-line description is shown big */
  firstTime: boolean;
}

/** a story's seeded works (the inviter's, KIMORIN's) join the ones around your place; same id = the feed's wins */
export function stageOf(view: PlanetHomeView, opts: { now?: number; seeds?: HomeWork[]; hidden?: ReadonlySet<string> } = {}): Stage {
  const now = opts.now ?? Date.now();
  const hidden = opts.hidden ?? new Set<string>();
  const ids = new Set(view.around.map((w) => w.id));
  const around = [...view.around, ...(opts.seeds ?? []).filter((s) => !ids.has(s.id))].filter((w) => !hidden.has(w.id)).sort((a, b) => Date.parse(b.flownAt) - Date.parse(a.flownAt));
  const own = view.own.filter((w) => !hidden.has(w.id));
  const isFresh = (w: HomeWork) => isNewSince(w.flownAt, view.lastVisitAt);
  // what falls: the newest arrivals first; up to five alone, the rest together
  const fresh = [...own, ...around].filter(isFresh).sort((a, b) => Date.parse(b.flownAt) - Date.parse(a.flownAt));
  const plan = dropPlan(fresh.map((w) => w.id));
  const ones = new Set(plan.drops);
  const plus = new Set(plan.plus);
  const item = (w: HomeWork): StageItem => ({
    ...w,
    fresh: isFresh(w),
    drop: ones.has(w.id) ? 'one' : plus.has(w.id) ? 'plus' : null,
    leaving: w.rel !== 'own' && !w.demo && homeHoursLeft(w.flownAt, now) === 0,
  });
  return {
    own: own.map(item),
    around: around.map(item),
    far: view.far.filter((w) => !hidden.has(w.id)).map((w) => ({ ...w, fresh: false, drop: null, leaving: false })),
    plus: plus.size > 0,
    firstTime: view.lastVisitAt == null,
  };
}

/** Saturn: what is on the record, newest first from the outside — and so the order the needle reaches them */
export function recordOrder(stage: Stage): StageItem[] {
  return [...stage.own, ...stage.around.filter((w) => !w.leaving)].sort((a, b) => Date.parse(b.flownAt) - Date.parse(a.flownAt));
}

/** the play queue from one kororin on (tapping one makes it sing now, then the record carries on) */
export function queueFrom(list: readonly StageItem[], startId?: string): StageItem[] {
  const playable = list.filter((w) => !!w.url);
  const i = startId ? playable.findIndex((w) => w.id === startId) : 0;
  return i < 0 ? playable : [...playable.slice(i), ...playable.slice(0, i)];
}

/** move one of your own works up or down (並べかえ) */
export function moveOwn(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * the long-press menu (design/home §3): 〔ひらく〕〔推す / 推しを外す〕〔見えなくする〕〔通報する〕. A dachi is 推し by
 * themselves (no toggle); the young never get 〔推す〕 for a stranger; a scripted work and your own get none.
 */
export type MenuAct = 'open' | 'push' | 'unpush' | 'hide' | 'report';
export function menuFor(w: Pick<HomeWork, 'rel' | 'demo'>, young: boolean): MenuAct[] {
  if (w.demo || w.rel === 'own') return [];
  const oshi: MenuAct[] = w.rel === 'oshi' ? ['unpush'] : w.rel === 'stranger' && !young ? ['push'] : [];
  return ['open', ...oshi, 'hide', 'report'];
}
