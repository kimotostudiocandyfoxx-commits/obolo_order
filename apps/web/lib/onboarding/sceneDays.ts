/**
 * Which app day a script scene belongs to (simple version, M-R198). The script's scene ids run one ahead of the
 * app's days: day 1 = D01 (Earth), day 2 = D02 + D03 (the ticket, KIMORIN, the rocket, the Moon), day 3 = D04 (Saturn), day 4 = D05
 * (Jupiter), day 5 = D06 (Mercury), day 6 = D07 (Mars), day 7 = D07V (Venus), day 8 = D08 (Earth → the Sun).
 * SYS-* and M-* scenes are not on a day (null).
 */
export function SCENE_DAY(id: string): number | null {
  const m = id.match(/^D(\d\d)(V?)-/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2]) return 7;
  return ({ 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 8 } as Record<number, number>)[n] ?? null;
}
