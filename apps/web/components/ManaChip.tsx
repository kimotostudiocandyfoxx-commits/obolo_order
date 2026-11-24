'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { WALLET_CHANGED } from '@/components/ManaGemSheet';
import { useAuth } from '@/lib/auth';

export function ManaChip() {
  const { status } = useAuth();
  const [mana, setMana] = useState<number | null>(null);
  useEffect(() => {
    if (status !== 'authed') return;
    const load = () =>
      getApi()
        .wallet()
        .then((w) => setMana(w.manaBalance))
        .catch(() => setMana(null));
    void load();
    // a mana gem was bought (ManaGemSheet)
    window.addEventListener(WALLET_CHANGED, load);
    return () => window.removeEventListener(WALLET_CHANGED, load);
  }, [status]);
  if (status !== 'authed' || mana === null) return null;
  return (
    <Link href="/settings" className="chip bg-[color:var(--color-mana)]/20 px-2.5 py-1 text-xs text-[color:var(--color-mana)]">
      {mana.toLocaleString()} MANA
    </Link>
  );
}
