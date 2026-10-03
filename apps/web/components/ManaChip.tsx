'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function ManaChip() {
  const { status } = useAuth();
  const [mana, setMana] = useState<number | null>(null);
  useEffect(() => {
    if (status !== 'authed') return;
    getApi()
      .wallet()
      .then((w) => setMana(w.manaBalance))
      .catch(() => setMana(null));
  }, [status]);
  if (status !== 'authed' || mana === null) return null;
  return (
    <Link href="/earth" className="chip bg-[color:var(--color-mana)]/20 px-2.5 py-1 text-xs text-[color:var(--color-mana)]">
      ✦ {mana.toLocaleString()} MANA
    </Link>
  );
}
