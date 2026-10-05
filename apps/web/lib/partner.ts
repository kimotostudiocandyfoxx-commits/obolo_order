'use client';

import { useAuth } from '@/lib/auth';
import { demoBati } from '@/lib/look';
import { spriteUrl } from '@/lib/onboarding/media';

/**
 * Who makes things with the visitor (作曲 / 撮影 / つくる). Client decision 2026-10-05: the Bati,
 * hatched on day 4 from the favourite food. KIMORIN stands in only if there is no Bati yet.
 */
export interface Partner {
  name: string;
  face: string;
  isBati: boolean;
  /** sentence ending for the partner's voice ("ケン" for KIMORIN) */
  end: string;
}

export function usePartner(): Partner {
  const { me } = useAuth();
  const b = me?.bati;
  if (b?.name) return { name: b.name, face: b.imageUrl || demoBati(b.food), isBati: true, end: '' };
  return { name: 'KIMORIN', face: spriteUrl('kimorin-face'), isBati: false, end: 'ケン' };
}
