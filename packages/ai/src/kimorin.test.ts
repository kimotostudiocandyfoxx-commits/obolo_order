import { describe, expect, it } from 'vitest';
import { KIMORIN_CHARACTER, kimorinReply, tidyKimorin } from './kimorin';

describe('R9: KIMORIN⭐︎ answers', () => {
  it('the persona: polite, the wait lines as its voice, the same safety as {bati}', () => {
    expect(KIMORIN_CHARACTER).toContain('です・ます');
    expect(KIMORIN_CHARACTER).toContain('……あの結社、まだ怪しいと思っています');
    expect(KIMORIN_CHARACTER).toContain('診断はしない');
    expect(KIMORIN_CHARACTER).toContain('話を向けない');
  });
  it('tidy: no emoji, three sentences at most', () => {
    expect(tidyKimorin('はい🔧。そうです。……たぶん。四つめです。')).toBe('はい。そうです。……たぶん。');
  });
  it('asks the provider with the talk, the member last', async () => {
    let seen: { system: string; history: { role: string; text: string }[] } | null = null;
    const out = await kimorinReply({ name: 'fake', chat: async (r) => ((seen = r), 'こんにちは。') }, { userName: 'ネオ', history: [{ role: 'user', text: 'やあ' }] });
    expect(out).toBe('こんにちは。');
    expect(seen!.system).toContain('ネオ');
  });
});
