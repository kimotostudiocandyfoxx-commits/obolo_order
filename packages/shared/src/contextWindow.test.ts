import { describe, expect, it } from 'vitest';
import { BUDDY_CONTEXT_MESSAGES, contextWindow } from './config';

describe('R12: the recent turns sent to {bati}', () => {
  const turns = Array.from({ length: 70 }, (_, i) => ({ role: i % 2 ? 'buddy' : 'user', text: `message ${i}` }));
  it('keeps the last 20 turns (40 messages), newest last', () => {
    expect(BUDDY_CONTEXT_MESSAGES).toBeGreaterThanOrEqual(40);
    const w = contextWindow(turns);
    expect(w).toHaveLength(BUDDY_CONTEXT_MESSAGES);
    expect(w[w.length - 1].text).toBe('message 69');
    expect(w[0].text).toBe(`message ${70 - BUDDY_CONTEXT_MESSAGES}`);
  });
  it('drops the oldest first when the turns are long', () => {
    const long = [{ text: 'a'.repeat(5000) }, { text: 'b'.repeat(2000) }, { text: 'c'.repeat(2000) }];
    expect(contextWindow(long, 40, 6000).map((t) => t.text[0])).toEqual(['b', 'c']);
    // the newest is kept even when it alone is over the bound
    expect(contextWindow([{ text: 'x'.repeat(9000) }], 40, 6000)).toHaveLength(1);
    expect(contextWindow([{ text: '' }, { text: 'hi' }])).toEqual([{ text: 'hi' }]);
  });
});
