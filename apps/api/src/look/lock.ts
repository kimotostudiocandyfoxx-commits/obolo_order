import { HttpStatus } from '@nestjs/common';
import { BATI_LOOK_LOCKED_LINE, LOOK_LOCKED_LINE, lookConfirmed, profileLookLocked } from '@obolo/shared';
import { apiError } from '../common/errors';
import type { users } from '../db/schema';
import { activeMember } from '../users/tester';
import { activeBati } from './batis';

type Row = typeof users.$inferSelect;
const story = (u: Row) => (u.onboardingJson ?? {}) as Record<string, string>;

/** the key the first look's confirmation (end of day 2) is kept under in onboardingJson: the look confirmed */
export const LOOK_CONFIRMED_KEY = 'look.confirmed';

/**
 * the first look's profileLook making: the ledger row taken when it is confirmed (idempotent: one per member, a retry or
 * a second call never takes it twice) and the job its day-2 pictures are recorded under
 */
export const firstLookKey = (userId: string) => `make:profileLook:first:${userId}`;

/** client 2026-11-25: the own look was confirmed (at the end of day 2, or the member is past it) */
export function lookConfirmedOf(u: Row): boolean {
  return lookConfirmed({ journeyDay: u.journeyDay, journeyCompletedAt: u.journeyCompletedAt, confirmed: !!story(u)[LOOK_CONFIRMED_KEY] });
}

/** client 2026-11-25: a change of the own profile look is refused — confirmed, and not an Obolo Order member */
export function lookLockedOf(u: Row): boolean {
  return profileLookLocked({ journeyDay: u.journeyDay, journeyCompletedAt: u.journeyCompletedAt, confirmed: !!story(u)[LOOK_CONFIRMED_KEY], hasLook: !!u.avatarUrl, member: activeMember(u) });
}

/** 403 LOOK_LOCKED with {bati}'s words (PLACEHOLDER line, LOOK_LOCKED_LINE) */
export function lookLocked(u: Row) {
  return apiError(HttpStatus.FORBIDDEN, 'LOOK_LOCKED', LOOK_LOCKED_LINE.replace('{neo}', u.displayName || 'きみ'));
}

/**
 * client 2026-11-27 (M-R338): {bati}'s look is decided on day 2 and stays as it is until Obolo Order — a resident may not
 * change it by any way (the old free dress-up, wearing one of its pictures, putting an earlier look back); a member
 * changes it through the step round (steps.service.ts) or a paid making
 */
export function batiLookLockedOf(u: Row): boolean {
  return !activeMember(u);
}

/**
 * {bati}'s step round (steps.service.ts: step / back / fix) is open while day 2 is still being lived — the day its look
 * is decided (D03-S005b) — and for an Obolo Order member. Past day 2 a resident's round is closed whether or not it was
 * ever decided: one that was left open on day 2 can't be stepped on later for free (BATI_LOOK_LOCKED)
 */
export function batiRoundLockedOf(u: Row): boolean {
  return !activeMember(u) && lookConfirmed({ journeyDay: u.journeyDay, journeyCompletedAt: u.journeyCompletedAt, confirmed: false });
}

/** 403 BATI_LOOK_LOCKED with {bati}'s words (PLACEHOLDER line, BATI_LOOK_LOCKED_LINE; {self}: its 一人称) */
export function batiLookLocked(u: Row) {
  return apiError(HttpStatus.FORBIDDEN, 'BATI_LOOK_LOCKED', BATI_LOOK_LOCKED_LINE.replace('{self}', activeBati(u)?.self || 'ボク'));
}

/** 410 LOOK_ENDPOINT_GONE: an old free way to change a look that no screen uses any more (the step round took its place) */
export function lookEndpointGone() {
  return apiError(HttpStatus.GONE, 'LOOK_ENDPOINT_GONE', 'This way to change a look is gone: use /me/look/steps');
}

/** the back view of the look worn now (made with the talk's pictures; none for another look) */
export function lookBackOf(u: Row): string | null {
  const j = story(u);
  return j['look.back'] && j['look.back.of'] === u.avatarUrl ? j['look.back'] : null;
}
