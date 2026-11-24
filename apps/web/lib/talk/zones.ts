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
