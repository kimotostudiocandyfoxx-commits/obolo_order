import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ getApi: () => ({ batiSays: async () => ({ url: null }) }) }));
import { SPEAK_MAX, speakable } from './batiSpeak';

describe('client 2026-11-24: what {bati} reads aloud in the Moon chat', () => {
  it('short words as they are', () => {
    expect(speakable('やっほー、ネオ！')).toBe('やっほー、ネオ！');
  });
  it('long words: up to the last sentence end within the cap', () => {
    const t = `${'あ'.repeat(60)}。${'い'.repeat(100)}`;
    expect(speakable(t)).toBe(`${'あ'.repeat(60)}。`);
  });
  it('no sentence end within the cap: cut at the cap', () => {
    expect(speakable('う'.repeat(300))).toHaveLength(SPEAK_MAX);
  });
});
