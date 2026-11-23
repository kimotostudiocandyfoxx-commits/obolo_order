/**
 * Background plates for the directed row (client review of M-R251, 2026-11-23). The story's stills are framed as close
 * shots for big painted characters; in the row the figures stand small (three in front, none overlapping), so each
 * day-3+ row scene gets a plate made for that size: a wider, emptier establishing shot of the same place (made from
 * the still with Seedream edit / outpaint, scripts/story-images/m-r251/plates.json), with
 *   floorY    where the feet land (0..1 of the plate's height): it is put at the row's ground line on screen
 *   horizonY  the eye level (about the chest of a standing figure), for checking the perspective
 * A plate moves with the camera exactly as the row does (the same origin and scale), so the feet stay on the floor at
 * every shot; it is sharp, a little soft only in close-ups. The stills stay as they are for the cinema of days 1–2 and
 * for the still steps.
 */
export type Plate = { image: string; floorY: number; horizonY: number };

/** scene id → its plate (row mode). Empty until the plates are made (see scripts/story-images/m-r251). */
export const PLATES: Record<string, Plate> = {};

/**
 * Stills with a character painted in who also stands in the row → the same still with them painted out (Seedream
 * edit). Used in the row (shown sharp); the original stays for the cinema. Empty until made.
 */
export const STILL_CLEAN: Record<string, string> = {};

export const plateUrl = (image: string) => `/onboarding/${image}`;
