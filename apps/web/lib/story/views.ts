import VIEWS from './views.json';

/**
 * The other views of the story characters (made by the views job; client review of M-R251): per id — a sprite stem
 * (kimorin-sun, monban …) or a speaker (KIMORIN, MONBAN …) — its view files and where its feet and head are. The
 * directed row uses them for the angled cuts (lib/talk/direction.ts: q3 / side / ots); a missing view falls back
 * (no back view → no over-the-shoulder; no side or 3/4 view → the front figure, mirrored or turned).
 */
type Entry = { views?: { back?: string; side?: string; q3?: string; front?: string }; back?: string; side?: string; q3?: string; footY?: number; head?: { x: number; y: number; w: number; h: number } };
const ALL = VIEWS as Record<string, Entry>;

const url = (f?: string) => (!f ? undefined : f.startsWith('/') || f.startsWith('http') ? f : `/onboarding/${f}`);

/** a person's views by their sprite (then their speaker name) */
export function viewsOf(...keys: (string | undefined)[]): { back?: string; side?: string; q3?: string } | undefined {
  for (const k of keys) {
    const e = k ? (ALL[k] ?? ALL[k.toLowerCase()]) : undefined;
    if (!e) continue;
    const v = e.views ?? e;
    const out = { back: url(v.back), side: url(v.side), q3: url(v.q3) };
    return out.back || out.side || out.q3 ? out : undefined;
  }
  return undefined;
}
