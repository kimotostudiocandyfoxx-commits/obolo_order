/**
 * Which app day a script scene belongs to (simple version, M-R198). The script's scene ids run one ahead of the
 * app's days: day 1 = D01 (Earth), day 2 = D02 + D03 (the ticket, KIMORIN, the rocket, the Moon), day 3 = D04 (Saturn), day 4 = D05
 * (Jupiter), day 5 = D06 (Mercury), day 6 = D07 (Mars), day 7 = D07V (Venus).
 * M-R341 (2026-11-27): day 8 = M-PLUTO, day 9 = M-NEPTUNE, day 10 = M-URANUS (the outer planets, before becoming Obolo
 * Order) and day 11 = D08 (Earth → the Sun) with M-END (the end, after the Eclipse). SYS-* scenes are not on a day (null).
 */
export function SCENE_DAY(id: string): number | null {
  const outer = id.match(/^M-(PLUTO|NEPTUNE|URANUS|END)-/);
  if (outer) return { PLUTO: 8, NEPTUNE: 9, URANUS: 10, END: 11 }[outer[1] as 'PLUTO' | 'NEPTUNE' | 'URANUS' | 'END'];
  const m = id.match(/^D(\d\d)(V?)-/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2]) return 7;
  return ({ 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 11 } as Record<number, number>)[n] ?? null;
}
