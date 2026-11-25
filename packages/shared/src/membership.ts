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

/**
 * Client decision 2026-11-25: the profile look is confirmed when day 2 is finished (the night on the Moon; its full
 * profileLook price is taken then from the gem). After that a resident's own look stays as it is until they join the
 * Order; a member changes it again, each change at the full profileLook. {bati}'s dress-up is not affected. A look that
 * was removed (〔写真を消す〕, M-R247) or never made (a preset form) can be made again.
 */
export interface LookLockLike {
  journeyDay: number;
  journeyCompletedAt?: string | Date | null;
  /** the look confirmed at the end of day 2 (the API's onboardingJson 'look.confirmed') */
  confirmed?: boolean;
  /** an own look is worn now */
  hasLook: boolean;
  member: boolean;
}
/** the profile look was confirmed (or the member is past day 2: confirmed before the price was taken) */
export function lookConfirmed(s: Pick<LookLockLike, 'journeyDay' | 'journeyCompletedAt' | 'confirmed'>): boolean {
  return !!s.confirmed || s.journeyDay > 2 || (s.journeyDay === 2 && !!s.journeyCompletedAt);
}
/** a change of the own profile look is refused (LOOK_LOCKED) */
export function profileLookLocked(s: LookLockLike): boolean {
  return !s.member && s.hasLook && lookConfirmed(s);
}
/**
 * PLACEHOLDER (story chat, client 2026-11-25): {bati}'s words when a resident asks to change their own look after it
 * was confirmed — provisional until the story chat writes them ({neo}: the member's name)
 */
export const LOOK_LOCKED_LINE = '{neo}の姿は、もう決まったよ。Obolo Orderに入ったら、また変えられるからね';
