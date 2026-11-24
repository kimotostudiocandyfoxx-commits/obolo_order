'use client';

import { useEffect, useState } from 'react';
import { EclipseGuide, useResident } from '@/components/onboarding/EclipseGuide';
import { ManaGemSheet } from '@/components/ManaGemSheet';

/** Bati's line when the month's spring is empty (D08-S002, L2-EARTH-S001) */
const EMPTY = { who: 'バティ', text: '今月の泉は、からっぽになっちゃった。……来月になると、また湧いてくるよ。' };

/**
 * The gem ran dry (402 NO_MANA from a making — M-R132). A resident is offered the Eclipse (its gem fills each
 * month); an Obolo Order hears from Bati that this month's spring is empty, and the 〔マナジェムを買う〕 sheet opens
 * right there (P-BILL-1). It also hosts the sheet opened by openManaGems() (the wallet, the settings).
 */
export function NoManaNotice() {
  const [on, setOn] = useState<null | 'nomana' | 'gems'>(null);
  const resident = useResident();
  useEffect(() => {
    const dry = () => setOn('nomana');
    const gems = () => setOn('gems');
    window.addEventListener('obolo:nomana', dry);
    window.addEventListener('obolo:managems', gems);
    return () => {
      window.removeEventListener('obolo:nomana', dry);
      window.removeEventListener('obolo:managems', gems);
    };
  }, []);
  if (!on) return null;
  if (resident && on === 'nomana') return <EclipseGuide what="マナを使って新しく作るの" onClose={() => setOn(null)} />;
  // an Obolo Order's mana wells up from the spring in the chest, not from the gem — when it is empty, more can be bought
  return <ManaGemSheet lead={on === 'nomana' ? EMPTY : undefined} onClose={() => setOn(null)} />;
}
