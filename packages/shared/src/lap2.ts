import { z } from 'zod';

/**
 * The second journey (L2, story draft 21: review/L2_*.md) — only for an Obolo Order. Familiar planets, where the
 * member finishes their own look and their own places: Earth → the Moon (Bati answers, the look) → Saturn
 * (invitations, your ひろば) → Jupiter (my tree) → Mercury (my island) → Mars (my studio, the theatre, MIKIE⭐︎)
 * → Venus (DJ・VJ) → Uranus (the atelier) → Neptune (the playing side) → back to Earth, where 〔みんな〕 opens.
 * No 24-hour clock: every chapter ends with 〔(next)へ向かう〕 or 〔今日はここまで〕, and the next open starts
 * from that choice. Progress is `story['l2.done']` on Me (chapters finished, 0–9).
 */
export const LAP2 = [
  // `go`: the button that starts this chapter (the end of the chapter before it, and the resume after 〔今日はここまで〕)
  { id: 'earth', planet: 'earth', go: '' },
  { id: 'saturn', planet: 'saturn', go: '土星へ向かう' },
  { id: 'jupiter', planet: 'jupiter', go: '木星へ向かう' },
  { id: 'mercury', planet: 'mercury', go: '水星へ向かう' },
  { id: 'mars', planet: 'mars', go: '火星へ向かう' },
  { id: 'venus', planet: 'venus', go: '金星へ向かう' },
  { id: 'uranus', planet: 'uranus', go: '天王星へ向かう' },
  { id: 'neptune', planet: 'neptune', go: '海王星へ向かう' },
  // back on Earth (L2-RETURN): the round's cards, that night (riddle 3), the next morning (the comms room)
  { id: 'home', planet: 'earth', go: '地球へ帰る' },
  { id: 'night', planet: 'earth', go: '次へ' },
  { id: 'room', planet: 'earth', go: '次へ（翌朝）' },
] as const;
export type Lap2Chapter = (typeof LAP2)[number]['id'];
export const LAP2_DONE = LAP2.length;

/** chapters finished on the second journey (0 = not started … LAP2_DONE = back on Earth) */
export function lap2Done(story: Record<string, string> | undefined): number {
  const n = Number(story?.['l2.done'] ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(LAP2_DONE, Math.floor(n))) : 0;
}

export const CompleteLap2Body = z.object({
  chapter: z.number().int().min(0).max(LAP2_DONE - 1),
  /** what was made / chosen in the chapter, kept as `l2.<chapter id>.<key>` */
  answers: z.record(z.string().max(40), z.string().max(200)).optional(),
});
export type CompleteLap2Body = z.infer<typeof CompleteLap2Body>;
