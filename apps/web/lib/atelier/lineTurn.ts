import { rotateLine } from '@obolo/shared';

/**
 * M-R253 §6: a scene with several {bati} lines uses them in turn, never the same twice in a row — the last one used is
 * kept per scene on this device.
 */
const KEY = 'obolo.atelier.lineTurn.v1';
const mem: Record<string, number> = {};

export function nextLine<T extends string>(scene: string, options: readonly T[]): T {
  let last: Record<string, number> = { ...mem };
  try {
    last = { ...mem, ...((JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>) ?? {}) };
  } catch {
    /* no memory: from the first */
  }
  const i = rotateLine(options.length, last[scene] ?? -1);
  mem[scene] = i;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...last, [scene]: i }));
  } catch {
    /* said in turn while the page is open only */
  }
  return options[i];
}
