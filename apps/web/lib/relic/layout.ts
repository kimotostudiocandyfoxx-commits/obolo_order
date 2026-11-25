/**
 * R12 relics (pure parts, tested in layout.test.ts): how a sent thing floats — its own bob, tilt and phase from its id
 * (the same relic always floats the same way, as the spell's talismans do), how several sent together sit as a small
 * cluster, and which messages of a talk go together.
 */

/** a steady number per id */
export const relicSeed = (s: string) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);

export type FloatParams = {
  /** one bob, s */
  dur: number;
  /** where in its bob it starts (negative, s): neighbours never move together */
  delay: number;
  /** its resting tilt and the tilt at the top of its bob (deg) */
  tilt0: number;
  tilt1: number;
  /** a small sideways drift at the top of its bob (px) */
  dx: number;
  /** how high it bobs (px) */
  lift: number;
};

/** the float of one relic (the gentle bob of the spell's talismans: 5–8 s, ±1.6°, 4–6 px) */
export function floatParams(id: string, k = 0): FloatParams {
  const s = (relicSeed(id) + k * 7919) >>> 0;
  return {
    dur: 5.4 + (s % 9) * 0.32,
    delay: -((s >>> 3) % 23) * 0.37 - k * 1.3,
    tilt0: (((s >>> 5) % 7) - 3) * 0.55,
    tilt1: (((s >>> 7) % 7) - 3) * -0.5,
    dx: ((s >>> 9) % 5) - 2,
    lift: 4 + ((s >>> 11) % 3),
  };
}

export type ClusterSpot = {
  /** the relic's scale in the cluster (several are a little smaller than one) */
  scale: number;
  /** its row and its place in the row (rows of `perRow`, fanned: each overlaps the one before a little) */
  row: number;
  col: number;
  /** a staggered height (px) and its own lean (deg) */
  dy: number;
  rot: number;
  z: number;
};

/**
 * several relics sent together: a small fanned cluster — rows of `perRow` (three), each a little smaller, every other one
 * lower, leaning its own way, overlapping the one before; the sender's side first (the caller mirrors it for "mine").
 */
export function clusterSpots(n: number, perRow = 3): ClusterSpot[] {
  if (n <= 1) return [{ scale: 1, row: 0, col: 0, dy: 0, rot: 0, z: 1 }];
  const scale = n === 2 ? 0.74 : 0.6;
  const rots = [-4, 3.2, -2, 3.6, -3, 2.2];
  return Array.from({ length: n }, (_, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    return { scale, row, col, dy: col % 2 ? 22 : 0, rot: rots[i % rots.length], z: 10 + (col % 2 ? 1 : 2) - row };
  });
}

/** how much of a relic the next one in its row covers (of its width) */
export const CLUSTER_OVERLAP = 0.22;

/** how many relics go in a cluster's row at this talk width */
export const clusterPerRow = (width: number) => (width >= 700 ? 4 : 3);

export type GroupIn = { who: string; at: number; relicOnly: boolean };
/** messages within this long of the one before (same sender, relics only) float together */
export const CLUSTER_GAP_MS = 2 * 60_000;
export const CLUSTER_MAX = 6;

/**
 * which messages go together: runs of relic-only messages (a file, a work, a lone URL) from the same sender, each within
 * CLUSTER_GAP_MS of the one before, at most CLUSTER_MAX; every other message stands alone. Returns index groups in order.
 */
export function groupRelics(list: GroupIn[]): number[][] {
  const out: number[][] = [];
  list.forEach((m, i) => {
    const g = out[out.length - 1];
    const prev = i > 0 ? list[i - 1] : null;
    if (g && prev && m.relicOnly && prev.relicOnly && prev.who === m.who && m.at - prev.at <= CLUSTER_GAP_MS && m.at >= prev.at && g.length < CLUSTER_MAX) g.push(i);
    else out.push([i]);
  });
  return out;
}

/** the item index of each message (the unread line and the like count in items, not messages) */
export function itemIndexOf(groups: number[][]): number[] {
  const at: number[] = [];
  groups.forEach((g, k) => g.forEach((i) => (at[i] = k)));
  return at;
}

/** the wax seal's colour and letters for a document, by its name */
export function sealOf(name: string, mime = ''): { word: string; wax: string; hi: string } {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? '').toLowerCase();
  const m = mime.toLowerCase();
  if (ext === 'pdf' || m === 'application/pdf') return { word: 'PDF', wax: '#a3201f', hi: '#e2574c' };
  if (ext === 'doc' || ext === 'docx' || m.includes('wordprocessing') || m === 'application/msword') return { word: 'Word', wax: '#1f4fa3', hi: '#5a8de2' };
  if (ext === 'xls' || ext === 'xlsx' || m.includes('spreadsheet') || m === 'application/vnd.ms-excel') return { word: 'Excel', wax: '#1d7a45', hi: '#4fbf7e' };
  if (ext === 'ppt' || ext === 'pptx' || m.includes('presentation') || m === 'application/vnd.ms-powerpoint') return { word: 'PPT', wax: '#b8501a', hi: '#ee8a4a' };
  if (ext === 'csv' || m === 'text/csv') return { word: 'CSV', wax: '#13756f', hi: '#45bdb4' };
  if (ext === 'zip' || m === 'application/zip') return { word: 'ZIP', wax: '#5b3a8a', hi: '#9873cf' };
  if (ext === 'txt' || m === 'text/plain') return { word: 'TXT', wax: '#5d5a52', hi: '#9c978a' };
  return { word: (ext || 'FILE').toUpperCase().slice(0, 4), wax: '#6b4a1c', hi: '#b98a4a' };
}
