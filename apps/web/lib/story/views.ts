import { versioned } from '@/lib/onboarding/media';
import VIEWS from './views.json';

/**
 * The other views of the story characters (scripts/views/views.py writes views.json; client review of M-R251): per
 * character (a sprite stem: kimorin-sun, monban …; speakers map to them) its front picture and each view that exists
 * — q3 (3/4) and side face LEFT (mirror for right), back is seen from behind; every view shares the front's scale and
 * foot line. The directed row uses them for the angled cuts (lib/talk/direction.ts: q3 / side / ots); a missing view
 * falls back (no back view → no over-the-shoulder; no side or 3/4 view → the front figure, mirrored or turned).
 */
type View = { src: string; same?: string };
type Character = { name?: string; front?: View; views?: Partial<Record<'q3' | 'side' | 'back', View | string>> };
const M = VIEWS as unknown as { characters?: Record<string, Character>; speakers?: Record<string, string> };

// (a view repainted under the same name carries its version: /onboarding is cached for a day)
const srcOf = (v?: View | string) => {
  const src = typeof v === 'string' ? v : v?.src;
  return src ? versioned(src) : src;
};

/** a person's views by their sprite, then their speaker name (undefined: none made) */
export function viewsOf(...keys: (string | undefined)[]): { back?: string; side?: string; q3?: string } | undefined {
  for (const k of keys) {
    if (!k) continue;
    const c = M.characters?.[k] ?? M.characters?.[M.speakers?.[k] ?? ''];
    if (!c?.views) continue;
    // a back that is only the front picture again (OBOLON's orb, `same: 'front'`) is no back view: its face would show in
    // the foreground of an over-the-shoulder
    const back = typeof c.views.back === 'object' && c.views.back?.same === 'front' ? undefined : srcOf(c.views.back);
    const out = { back, side: srcOf(c.views.side), q3: srcOf(c.views.q3) };
    if (out.back || out.side || out.q3) return out;
  }
  return undefined;
}
