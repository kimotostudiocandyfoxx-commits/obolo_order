/**
 * Where the planet homes are in the story days 3–7 on the new homes (M-R330): prints [{ day, i, planet, place }] — the
 * step index of each 'home' step — for the review play page (/kakunin-5798f28713/play?day=N&i=<i>, in a build with the
 * planets' switch on) and its screenshots (docs/handoff/shots/story-<day>-<planet>.jpg).
 *   npx --yes tsx@4.19.2 apps/web/scripts/story-home-steps.ts
 */
import { STORIES_NEW_HOMES } from '../lib/onboarding/stories';

const out: { day: number; i: number; planet: string; place: string; scene: string }[] = [];
for (const day of [3, 4, 5, 6, 7]) {
  let scene = '';
  STORIES_NEW_HOMES[day].steps.forEach((s, i) => {
    if (s.t === 'scene') scene = s.id;
    if (s.t === 'home') out.push({ day, i, planet: s.planet, place: s.place, scene });
  });
}
console.log(JSON.stringify(out));
