'use client';

import { useAuth } from '@/lib/auth';
import { demoBati } from '@/lib/look';

/**
 * Who makes things with the visitor (作曲 / 撮影 / つくる). Client decision 2026-10-05: the Bati,
 * hatched on day 4 from the favourite food. Client 2026-11-24 (iPad, R7): with no Bati yet (a tester who jumped days)
 * the stand-in is a neutral Bati — named バティ, seen as the egg — never KIMORIN (KIMORIN is a ダチ).
 */
export interface Partner {
  name: string;
  face: string;
  isBati: boolean;
  /** sentence ending for the partner's voice (none for a Bati) */
  end: string;
  /** no Bati of their own yet: the neutral stand-in (バティ, the egg) */
  placeholder?: boolean;
}

/** the neutral stand-in's picture: the egg (the moon's; the sun's when that egg was chosen) */
export const PLACEHOLDER_BATI_FACE = '/onboarding/egg-pick-earth.webp';

export function usePartner(): Partner {
  const { me } = useAuth();
  const b = me?.bati;
  if (b?.name) return { name: b.name, face: b.imageUrl || demoBati(b.food), isBati: true, end: '' };
  // speaks as a Bati (the words as written, no KIMORIN ケン), named バティ, the egg for its picture
  return { name: 'バティ', face: b?.egg === 'sun' ? '/onboarding/egg-pick-sun.webp' : PLACEHOLDER_BATI_FACE, isBati: true, end: '', placeholder: true };
}
