/**
 * R9 (client): the Moon temple as one place with zones, the three plates painted for the client's map
 * (design/story/refs/moon-temple-zones-client.jpg), all from where you stand, the top of the short steps between the
 * inner sanctum and the great hall, at eye level, the same night:
 *  - bati: looking in, {bati}'s place before the wide water bowl (the bowl's position is in
 *    components/atelier/BowlFx.tsx TEMPLE_PLATE: a new plate needs its bowl's centre there too);
 *  - hall: looking out, down the steps into the great circular hall, where the ダチ you talk with most stroll (the ダチ
 *    tab's main view; MoonTabs' strollers stand on its floor);
 *  - outside: the lunar plain below the temple's front stairs, everyone else.
 * Sources: design/story/out/moon-zone-*.jpg (the queue's moon-zone-* items).
 */
export const MOON_ZONES = {
  hall: '/talk/moon/temple-hall.webp',
  outside: '/talk/moon/temple-outside.webp',
  bati: '/talk/moon/temple-bati.webp',
} as const;

/** each plate's horizon (the camera's eye level), as a fraction of its height from the bottom: the strollers' rows shrink toward it */
export const MOON_ZONES_EYE = { hall: 0.47, outside: 0.4 } as const;

/** the great hall's depth rows, front to back (client): the top 2 by the week's talk large in front, ranks 3–6 in the middle, 7–8 far at the back */
export const HALL_ROWS = [2, 4, 2] as const;

/**
 * Where each stroller stands, in rank order: its row (0 = nearest) and its place in that row (0 = leftmost). With
 * `caps` (the hall), the rows fill front first, then the middle, then the back; without (the plain), one row for up to
 * 4, two for up to 10, else three, dealt in turn so the nearest row gets the first.
 */
export function strollSlots(n: number, caps: readonly number[] | null): { r: number; k: number }[] {
  const out: { r: number; k: number }[] = [];
  if (caps) {
    let r = 0;
    let k = 0;
    for (let i = 0; i < n; i++) {
      while (r < caps.length - 1 && k >= caps[r]) (r++, (k = 0));
      out.push({ r, k: k++ });
    }
    return out;
  }
  const rows = n <= 4 ? 1 : n <= 10 ? 2 : 3;
  for (let i = 0; i < n; i++) out.push({ r: i % rows, k: Math.floor(i / rows) });
  return out;
}
