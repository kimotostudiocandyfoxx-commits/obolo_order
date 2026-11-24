import { PLACE_BG } from './looks';

/**
 * R9 (client): the Moon temple as one place with zones. The plates are swapped here (and only here) when the client
 * picks the new ones (moon-zone-dachi / moon-zone-outside / moon-zone-bati, being generated):
 *  - hall: the great hall, where the ダチ you talk with most stroll (the ダチ tab's main view);
 *  - outside: the lunar plain below the temple's front stairs, everyone else;
 *  - bati: {bati}'s place, before the water bowl (the bowl's position is in components/atelier/BowlFx.tsx TEMPLE_PLATE:
 *    a new plate needs its bowl's centre there too).
 * PLACEHOLDER until the client picks: the current ダチ backdrop for the hall, the existing Moon surface outside.
 */
export const MOON_ZONES = {
  hall: PLACE_BG.moon,
  outside: '/onboarding/s/moon-surface.jpg',
  bati: '/onboarding/s/plate-moon-temple.jpg',
} as const;
