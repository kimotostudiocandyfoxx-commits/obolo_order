/**
 * Who is an Obolo Order member right now (P-BILL-4). Paying once (`orderedAt`) is not enough: when the Stripe
 * subscription ends — `canceled` (cancelled, or Stripe gave up after its retries with "cancel"), `unpaid` (Stripe gave
 * up with "mark unpaid"), `incomplete_expired` or `paused` — the member features close. The works and data stay, and
 * paying again (〔もう一度はじめる〕 in the settings) opens them again. `past_due` (Stripe still retrying) stays open.
 * Demo payments (`demo`) and tester accounts stay members.
 */
export const ENDED_SUBSCRIPTION_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'paused'] as const;

export interface MemberLike {
  orderedAt?: string | Date | null;
  subscriptionStatus?: string | null;
  /** the API's isTester / Me.tester */
  tester?: boolean;
}

/** paid for the Eclipse, and the subscription has not ended (testers always, once they have joined) */
export function isActiveMember(m: MemberLike | null | undefined): boolean {
  if (!m?.orderedAt) return false;
  if (m.tester) return true;
  return !(ENDED_SUBSCRIPTION_STATUSES as readonly string[]).includes(m.subscriptionStatus ?? '');
}

/** joined once, but the subscription has ended: the member features are closed until they pay again */
export function membershipEnded(m: MemberLike | null | undefined): boolean {
  return !!m?.orderedAt && !isActiveMember(m);
}
