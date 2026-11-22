import { useMemo } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMercury } from '@/lib/mercury/state';
import { usePartner } from '@/lib/partner';
import type { Ctx } from './makers';

/** what the makers need from the page (who you are, {bati}, the demo's Mercury store) */
export function useAtelierCtx(): Ctx {
  const { me } = useAuth();
  const partner = usePartner();
  const mercury = useMercury();
  const live = getApi().mode === 'live';
  return useMemo(() => ({ live, me, partner: { name: partner.name, isBati: partner.isBati }, mercury }), [live, me, partner.name, partner.isBati, mercury]);
}
