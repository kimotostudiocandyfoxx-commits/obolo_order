import { MEDIA_CONSENT_VERSION } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { canUseMedia } from './media-consent';

const now = new Date('2026-11-22T00:00:00Z');
const row = (json: Record<string, string>, guardian = false) => ({
  consentVersion: MEDIA_CONSENT_VERSION,
  consentAt: now,
  guardianConsentVersion: guardian ? MEDIA_CONSENT_VERSION : null,
  guardianConsentAt: guardian ? now : null,
  onboardingJson: json,
});

describe('M-R252: the start screen branch is kept', () => {
  it('16+ agreed: used; the branch without media: never, whatever year comes later', () => {
    expect(canUseMedia(row({ birthYear: '1990' }), now)).toBe(true);
    expect(canUseMedia(row({ birthYear: '1990', 'consent.media': '0' }), now)).toBe(false);
    expect(canUseMedia(row({ birthYear: '2012' }, true), now)).toBe(true);
    expect(canUseMedia(row({ birthYear: '2012', 'consent.media': '0' }, true), now)).toBe(false);
    expect(canUseMedia(row({}), now)).toBe(false);
  });
});
