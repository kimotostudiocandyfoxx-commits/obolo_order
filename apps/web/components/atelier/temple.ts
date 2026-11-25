import { MOON_ZONES } from '../../lib/talk/zones';

/**
 * R9 (client): the Moon temple's water bowl, behind {bati} in its talk. While something is being made the water glows
 * (light rising off the surface, ripples spreading); when it is done the work rises out of the bowl toward the talk.
 * Transform and opacity only (60 fps on the iPad); reduced motion: a gentle fade, nothing moves.
 * The bowl's place on the temple plate (MOON_ZONES.bati, public/talk/moon/temple-bati.webp, 1152 × 2048): the water's
 * centre and its width, measured on the picture; `bati`: where {bati} stands on it, beside the bowl (TalkScene otsStand).
 */
export const TEMPLE_PLATE = { src: MOON_ZONES.bati, aspect: 1152 / 2048, bowl: { u: 0.508, v: 0.598, w: 0.37 }, bati: { v: 0.83, h: 0.62 }, batiFront: { v: 0.835, h: 0.7 } } as const;

/**
 * R15 (client, iPad): where a {bati} talk of the Moon chat is — the temple and its bowl, {bati} in the middle in front of
 * it, for the talk now and for every past one (a day opened from {bati}'s ≡ used to show the old Moon picture,
 * PLACE_BG.moon). A talk keeps no place of its own (shelf.ts Talk: id, at, msgs), so old and new talks look the same.
 */
export function batiTalkPlace() {
  return { place: TEMPLE_PLATE.src, placeAspect: TEMPLE_PLATE.aspect, otsAt: 0.5, otsStand: TEMPLE_PLATE.batiFront } as const;
}
