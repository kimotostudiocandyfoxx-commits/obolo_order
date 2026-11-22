import { MEDIA_CONSENT_VERSION, mediaAllowed } from '@obolo/shared';
import type { users } from '../db/schema';

type User = typeof users.$inferSelect;

/** the member agreed to the start-of-app terms that say what the voice is used for (M-R247) */
export const hasMediaConsent = (u: Pick<User, 'consentVersion' | 'consentAt'> | null | undefined) => !!u?.consentAt && u.consentVersion === MEDIA_CONSENT_VERSION;

/**
 * M-R248: the photo and the voice may be used — the agreement, and by age: never under 13 (or no birth year yet),
 * 13〜15 only with the guardian's consent, 16 and over their own. M-R252: never after the start screen's branch without
 * them (onboarding_json['consent.media'] = '0'), whatever year is given later.
 */
export function canUseMedia(u: Pick<User, 'consentVersion' | 'consentAt' | 'guardianConsentVersion' | 'guardianConsentAt' | 'onboardingJson'> | null | undefined, now = new Date()): boolean {
  if (!u) return false;
  const json = (u.onboardingJson ?? {}) as Record<string, string>;
  const birthYear = Number(json.birthYear) || null;
  const guardian = !!u.guardianConsentAt && u.guardianConsentVersion === MEDIA_CONSENT_VERSION;
  return mediaAllowed({ birthYear, consent: hasMediaConsent(u), guardian, media: json['consent.media'] !== '0' }, now);
}

