/**
 * M-R237: the spiral is a time map — a galaxy's arm from the oldest (the centre) to the newest (the outer end, the
 * biggest dots). At most ~30 dots: the newest each have their own, the older ones are one dot per day (and, when even
 * the days are too many, a few days to a dot).
 */
export type SpiralEntry = { id: string; at: string; color: string; glyph?: string };
export type SpiralDot = {
  key: string;
  /** the rows of the list this dot stands for: first..last (newest first) */
  first: number;
  last: number;
  at: string;
  color: string;
  glyph?: string;
  count: number;
  /** 0 = the oldest (centre) … 1 = the newest (outer end) */
  t: number;
};

export const SPIRAL_MAX = 30;
/** the arm's turns from the centre out */
export const TURNS = 2.1;

/** the device's own day */
export const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** entries newest first → dots newest first */
export function spiralDots(entries: SpiralEntry[], max = SPIRAL_MAX, day: (iso: string) => string = dayOf): SpiralDot[] {
  const n = entries.length;
  if (!n) return [];
  type G = { first: number; last: number };
  const daysFrom = (k: number): G[] => {
    const out: G[] = [];
    for (let i = k; i < n; i++) {
      const g = out[out.length - 1];
      if (g && day(entries[g.first].at) === day(entries[i].at)) g.last = i;
      else out.push({ first: i, last: i });
    }
    return out;
  };
  let groups: G[];
  if (n <= max) groups = entries.map((_, i) => ({ first: i, last: i }));
  else {
    // as many of the newest on their own as fit with the older ones a day to a dot
    let k = 0;
    let older = daysFrom(0);
    for (let j = 1; j <= n; j++) {
      const d = daysFrom(j);
      if (j + d.length > max) break;
      k = j;
      older = d;
    }
    groups = [...entries.slice(0, k).map((_, i) => ({ first: i, last: i })), ...older];
    if (groups.length > max) {
      // still too many days: a few days to a dot
      const size = Math.ceil(groups.length / max);
      const merged: G[] = [];
      for (let i = 0; i < groups.length; i += size) merged.push({ first: groups[i].first, last: groups[Math.min(groups.length, i + size) - 1].last });
      groups = merged;
    }
  }
  const m = groups.length;
  return groups.map((g, k) => {
    // the colour the group has the most of
    const c = new Map<string, number>();
    for (let i = g.first; i <= g.last; i++) c.set(entries[i].color, (c.get(entries[i].color) ?? 0) + 1);
    const color = [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const top = entries.slice(g.first, g.last + 1).find((e) => e.color === color)!;
    return { key: entries[g.first].id, first: g.first, last: g.last, at: entries[g.first].at, color, glyph: top.glyph, count: g.last - g.first + 1, t: m === 1 ? 1 : 1 - k / (m - 1) };
  });
}

/** the dot that holds list row i */
export const dotOfRow = (dots: SpiralDot[], i: number) => Math.max(0, dots.findIndex((d) => i >= d.first && i <= d.last));

/** where a point of the arm is: angle (radians, before the turn) and radius as a share of the whole */
export function armAt(t: number): { a: number; r: number } {
  return { a: t * TURNS * Math.PI * 2, r: 0.14 + 0.86 * t };
}
/** the turn that puts the arm's point t at the bottom (6 o'clock), where the list goes on */
export const turnFor = (t: number) => Math.PI / 2 - armAt(t).a;
