'use client';

import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * After Mars (day 8): "ORDERになるか？" — the subscription decision (¥88/month, spec §1.1).
 * PLACEHOLDER (P-BILL-1): Stripe is not wired; "ORDERになる" grants membership without payment.
 */
export function OrderScreen() {
  const { m, t } = useI18n();
  const { me, setMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);

  const join = async () => {
    setBusy(true);
    try {
      setMe(await getApi().becomeOrder());
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center bg-black px-8 text-center text-white"
      style={{ fontFamily: SERIF }}
    >
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
        <span className="absolute inset-0 animate-[spin-slow_30s_linear_infinite] rounded-full border border-dashed border-amber-200/40" />
        <span className="absolute inset-4 rounded-full border border-amber-200/30" />
        <span className="h-4 w-4 rounded-full bg-amber-100 shadow-[0_0_50px_16px_rgba(255,214,140,0.6)]" />
      </div>
      <p className="animate-[fadeUp_1.2s_ease-out] text-2xl tracking-[0.15em] text-amber-50">{t(m.order.title, { name: me?.displayName ?? '' })}</p>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">{m.order.lead}</p>
      <div className="mt-8 w-full max-w-xs rounded-2xl border border-amber-200/25 bg-white/[0.03] px-6 py-5">
        <p className="text-3xl tracking-wider text-amber-100">{m.order.price}</p>
        <ul className="mt-3 space-y-1.5 text-left text-sm text-white/75">
          {m.order.perks.map((p) => (
            <li key={p}>✦ {p}</li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => void join()}
        disabled={busy}
        className="mt-8 w-full max-w-xs rounded-full border border-amber-200/80 bg-amber-100/10 px-6 py-3.5 text-lg tracking-[0.25em] text-amber-50 shadow-[0_0_30px_rgba(255,210,130,0.35)] disabled:opacity-40"
      >
        {m.order.yes}
      </button>
      <button onClick={() => setLater(true)} className="mt-4 text-xs text-white/45 underline">
        {m.order.later}
      </button>
      {later && <p className="mt-3 text-xs text-amber-200/70">{m.order.thinkLater}</p>}
      <p className="mt-8 text-[11px] text-white/30">{m.order.billingSoon}</p>
    </main>
  );
}
