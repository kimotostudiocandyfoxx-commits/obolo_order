import { BuddyChatBody } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { chatHistory } from './buddy.service';

describe('R12: the turns {bati} answers with', () => {
  it('the talk sent by the app comes first, oldest first, then this message once', () => {
    const turns = [
      { role: 'user' as const, text: 'ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような' },
      { role: 'buddy' as const, text: '絵は、4日目から作れるようになるよ。' },
      { role: 'user' as const, text: '魔法で作って欲しい' },
    ];
    const h = chatHistory('魔法で作って欲しい', turns);
    expect(h.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(h[0].text).toContain('空飛ぶクジラ');
    expect(h[h.length - 1].text).toBe('魔法で作って欲しい');
  });
  it('keeps the last 20 turns (40 messages) of a long talk', () => {
    const turns = Array.from({ length: 60 }, (_, i) => ({ role: (i % 2 ? 'buddy' : 'user') as 'user' | 'buddy', text: `m${i}` }));
    const h = chatHistory('now', turns);
    expect(h).toHaveLength(41);
    expect(h[0].text).toBe('m20');
  });
  it('the body takes the history and canMake (bounded)', () => {
    expect(BuddyChatBody.parse({ text: 'x', history: [{ role: 'user', text: 'a' }], canMake: true })).toMatchObject({ canMake: true, history: [{ role: 'user', text: 'a' }] });
    expect(() => BuddyChatBody.parse({ text: 'x', history: Array.from({ length: 61 }, () => ({ role: 'user', text: 'a' })) })).toThrow();
  });
});
