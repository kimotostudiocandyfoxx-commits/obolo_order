'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * 〔設定〕 — for now the 〔毎月のマナ〕 part (M-R199 / M-R202): your mana, whether you are Obolo Order, and on days 3–7 of
 * the first journey 〔先にObolo Orderになる〕, which always plays SYS-S002 (the explanation) before the payment.
 * PLACEHOLDER (P-BILL-3): 〔やめる〕 (cancelling the monthly mana) is not built yet.
 */
export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const { me } = useAuth();
  const [mana, setMana] = useState<number | null>(null);
  useEffect(() => {
    getApi()
      .wallet()
      .then((w) => setMana(w.manaBalance))
      .catch(() => setMana(null));
  }, []);
  if (!me) return null;
  const ordered = !!me.orderedAt;
  // from the end of day 3 to day 7 (day 8 decides it in the story itself)
  const early = !ordered && (me.journeyDay > 3 || (me.journeyDay === 3 && !!me.journeyCompletedAt)) && me.journeyDay < 8;
  return (
    <main className="pt-safe pb-safe mx-auto min-h-svh max-w-md px-4 py-4">
      <header className="flex items-center gap-2">
        <Link href="/" className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="もどる">
          ←
        </Link>
        <h1 className="text-lg font-black">設定</h1>
      </header>
      <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-black text-[color:var(--color-mana)]">毎月のマナ</h2>
        <p className="mt-2 text-3xl font-black text-[color:var(--color-mana)]">✦ {mana === null ? '…' : mana.toLocaleString()}</p>
        <p className="mt-1 text-xs text-white/55">{ordered ? 'Obolo Order：毎月、体から88マナが湧きます（月額88円）' : '住人：マナジェムのマナで作ります'}</p>
        {early && (
          <Link href="/settings/order-early" className="mt-4 block rounded-full bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-center text-[15px] font-black text-slate-950">
            先にObolo Orderになる
          </Link>
        )}
        {ordered && <p className="mt-4 text-[11px] leading-relaxed text-white/45">やめ方：〔やめる〕の画面は準備中です。いつでもやめられます。</p>}
      </section>
    </main>
  );
}
