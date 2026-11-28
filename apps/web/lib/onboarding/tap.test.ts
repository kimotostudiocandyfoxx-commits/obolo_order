import { describe, expect, it } from 'vitest';
import { tapAction, TAP_FADE } from './tap';

const line = { say: true, revealing: false, voice: false, listen: false, waitOver: false };

describe('a tap on a line (client 2026-11-28): the reader goes on without waiting for the voice', () => {
  it('the first tap shows the whole text while it is still typing, the second goes on', () => {
    expect(tapAction({ ...line, revealing: true, voice: true })).toBe('reveal');
    expect(tapAction({ ...line, voice: true })).toBe('next');
  });
  it('a voice playing does not hold the tap: it fades out quickly and the story goes on', () => {
    expect(tapAction({ ...line, voice: true })).toBe('next');
    expect(TAP_FADE).toBeGreaterThan(0.1);
    expect(TAP_FADE).toBeLessThanOrEqual(0.3);
  });
  it('a line marked to be heard waits for its voice — but never forever', () => {
    expect(tapAction({ ...line, voice: true, listen: true })).toBe('wait');
    expect(tapAction({ ...line, voice: true, listen: true, waitOver: true })).toBe('next');
    expect(tapAction({ ...line, voice: false, listen: true })).toBe('next');
    // still typing: the text first, even on such a line
    expect(tapAction({ ...line, voice: true, listen: true, revealing: true })).toBe('reveal');
  });
  it('anything that is not a line goes on at once', () => {
    expect(tapAction({ ...line, say: false, revealing: true, voice: true, listen: true })).toBe('next');
  });
});
