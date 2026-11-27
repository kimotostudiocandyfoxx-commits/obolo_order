import { isActiveMember, JOURNEY_DONE, type Me } from '@obolo/shared';

/** M-R223: from day 3 (Bluena received), the first shelf also lists the looks worn before — your own and {bati}'s */
export function showPastLooks(me: Me): boolean {
  return !!me.story?.['d3.f_d04_bluena'] || me.journeyDay >= JOURNEY_DONE;
}

/**
 * Which of the two rows of looks worn before can be used (components/bati/BatiShelf.tsx PastLooks). A tap on one puts
 * that look back, and the API refuses it for a resident — {bati}'s look stays as decided on day 2 until Obolo Order
 * (403 BATI_LOOK_LOCKED, M-R338), and one's own once it is confirmed (403 LOOK_LOCKED, Me.lookLocked). A row whose
 * every tap would silently do nothing is not shown.
 */
export function pastLookRows(me: Me): { own: boolean; bati: boolean } {
  return { own: !me.lookLocked, bati: isActiveMember(me) };
}
