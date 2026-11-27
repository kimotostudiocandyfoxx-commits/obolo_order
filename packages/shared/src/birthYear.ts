import { z } from 'zod';

/**
 * Client 2026-11-27: nobody goes on without the year they were born. It is asked before day 1 (the start screen, the
 * seal), sent with the name when the account is made (POST /invites/:code/accept), and an account from before that has
 * none is asked over the app before anything else (web ConsentGate); the server refuses to move the journey on without
 * it (BIRTH_YEAR_REQUIRED). 〔答えない・分からない〕 is gone from the start screen.
 * The year: 1900 … this year (a year still to come is no answer).
 */
export const BIRTH_YEAR_MIN = 1900;
export function validBirthYear(y: unknown, now = new Date()): y is number {
  return typeof y === 'number' && Number.isInteger(y) && y >= BIRTH_YEAR_MIN && y <= now.getFullYear();
}
export const BirthYear = z
  .number()
  .int()
  .min(BIRTH_YEAR_MIN)
  .max(2100)
  .refine((y) => validBirthYear(y), 'A year that has not come yet');
/** the year kept on an account (users.onboarding_json.birthYear, a string), null = none */
export function birthYearOf(onboarding: unknown): number | null {
  const y = Number((onboarding as { birthYear?: unknown } | null | undefined)?.birthYear);
  return Number.isInteger(y) && y >= BIRTH_YEAR_MIN ? y : null;
}
/** what the app says when the server asks for the year (PROVISIONAL wording) */
export const BIRTH_YEAR_REQUIRED_WORDS = '生まれた年を、教えてください';
