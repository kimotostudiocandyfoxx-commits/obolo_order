/**
 * Background plates for the directed row (client review of M-R251, 2026-11-23). The story's stills are framed as close
 * shots for big painted characters; in the row the figures stand small (three in front, none overlapping), so each
 * place behind a day-3+ row scene gets a plate made for that size: a wider, emptier establishing shot of the same place (made from
 * the still with Seedream edit / outpaint, scripts/story-images/m-r251/plates.json), with
 *   floorY    where the feet land (0..1 of the plate's height): it is put at the row's ground line on screen
 *   horizonY  the eye level (about the chest of a standing figure), for checking the perspective
 * A plate moves with the camera exactly as the row does (the same origin and scale), so the feet stay on the floor at
 * every shot; it is sharp, a little soft only in close-ups. The stills stay as they are for the cinema of days 1–2 and
 * for the still steps.
 */
/** skyMask: the same size as the plate, white = sky (feathered), for the ambient layer's drifting sky */
export type Plate = { image: string; floorY: number; horizonY: number; skyMask?: string };

/**
 * still → the plate of that place (row mode): a scene whose background is that still stands on its plate. One plate a
 * place (the Moon temple serves every morning on the Moon). Empty until the plates are made (scripts/story-images/m-r251/plates.json).
 */
export const PLATES: Record<string, Plate> = {
  // made 2026-11-23 (Seedream edit of the still, scripts/story-images/m-r251/plates.json); floor / horizon read off the plate
  // skyMask: white = the sky (the space seen through the windows indoors), scripts/story-images/m-r251/skymask.py; none
  // where the derived mask was wrong (the ambient layer then finds the sky itself)
  's/moon-temple': { image: 's/plate-moon-temple.jpg', floorY: 0.8, horizonY: 0.5, skyMask: 's/plate-moon-temple-sky.png' },
  's/saturn-inside': { image: 's/plate-saturn-inside.jpg', floorY: 0.86, horizonY: 0.52, skyMask: 's/plate-saturn-inside-sky.png' },
  's/jupiter-forest': { image: 's/plate-jupiter-forest.jpg', floorY: 0.85, horizonY: 0.55 },
  's/mercury-port': { image: 's/plate-mercury-port.jpg', floorY: 0.82, horizonY: 0.5, skyMask: 's/plate-mercury-port-sky.png' },
  's/rocket-earth': { image: 's/plate-rocket-earth.jpg', floorY: 0.82, horizonY: 0.5 },
  's/launch-pit': { image: 's/plate-launch-pit.jpg', floorY: 0.84, horizonY: 0.55 },
  's/uranus-shop': { image: 's/plate-uranus-shop.jpg', floorY: 0.88, horizonY: 0.55 },
};
/** a scene that wants another plate than its still's (scene id → a PLATES key), or none at all (null) */
export const SCENE_PLATE: Record<string, string | null> = {};
export function plateFor(sceneId: string | null, still: string | null): Plate | undefined {
  if (sceneId && sceneId in SCENE_PLATE) {
    const k = SCENE_PLATE[sceneId];
    return k ? PLATES[k] : undefined;
  }
  return still ? PLATES[still] : undefined;
}

/**
 * Stills with a character painted in who also stands in the row → the same still with them painted out (Seedream
 * edit). Used in the row (shown sharp); the original stays for the cinema. Empty until made.
 */
export const STILL_CLEAN: Record<string, string> = {};

export const plateUrl = (image: string) => `/onboarding/${image}`;
