'use client';

import { isActiveMember } from '@obolo/shared';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { EclipsePay } from '@/components/onboarding/EclipsePay';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * P-BILL-4: 〔設定〕→〔エクリプス（月¥88）〕→〔もう一度はじめる〕 — a member whose subscription ended (canceled / unpaid)
 * pays again with the same checkout as the Eclipse (no story: they have heard it). The first join day is kept.
 */
export default function OrderAgainPage() {
  return (
    <RequireAuth>
      <OrderAgain />
    </RequireAuth>
  );
}

function OrderAgain() {
  const { me, setMe } = useAuth();
  const router = useRouter();
  if (!me) return null;
  return (
    <EclipsePay
      birthYear={me.birthYear}
      paid={isActiveMember(me)}
      onPaid={() => router.push('/settings')}
      onCancel={() => router.push('/settings')}
      failLine={{ who: 'MONBAN', text: '……まだ、終わっていない…。決めたら、また来い…。' }}
      api={{
        checkout: () => getApi().orderCheckout(),
        confirm: async (sessionId) => {
          setMe(await getApi().confirmOrder(sessionId));
        },
        demo: async () => {
          setMe(await getApi().becomeOrder());
        },
      }}
    />
  );
}
