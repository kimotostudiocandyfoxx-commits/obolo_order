import type { BatiEggKind } from '@obolo/shared';

/**
 * The egg chosen on the altar (D03-S005, M-R215): f_egg = moon / sun; a day saved before it read from the old choice
 * (太陽と月のたまご → sun, 地球と月のたまご → moon: the earth-and-moon egg's pictures stand in for the moon egg).
 */
export function eggOf(answers: Record<string, string>, story?: Record<string, string>): BatiEggKind {
  const f = answers.f_egg ?? story?.['d2.f_egg'];
  if (f === 'moon' || f === 'sun') return f;
  const label = answers.egg ?? story?.['d2.egg'] ?? '';
  return /太陽/.test(label) ? 'sun' : 'moon';
}

/** the picture files of an egg: the moon egg still uses the earth-and-moon egg's (PROVISIONAL, P-BATI-EGGS) */
export const eggFile = (egg: BatiEggKind) => (egg === 'moon' ? 'earth' : 'sun');
