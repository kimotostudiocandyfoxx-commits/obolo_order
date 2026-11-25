import { describe, expect, it } from 'vitest';
import { buddyAnswer, makeKindOf, parseTagged, readSort, sortInput } from './buddy';
import { batiOneCallRules, batiSort, DEFAULT_PERSONA } from './prompts/bati';
import type { ChatRequest, LlmProvider } from './types';

const ctx = { buddyName: 'バティ', persona: DEFAULT_PERSONA, memorySummary: null, userDisplayName: 'ユキ', locale: 'ja' as const };

/** a two-call provider (Gemini's way: the sorting next to the answer) that records what it was sent */
function twoCall(sortReply: string, answer = 'いいね！') {
  const sent: ChatRequest[] = [];
  const llm: LlmProvider = {
    name: 'fake',
    chat: async (req) => {
      sent.push(req);
      return req.maxOutputTokens === 50 ? sortReply : answer;
    },
  };
  return { llm, sent };
}

describe('R12: a making request in the Moon atelier is classified in the same call as the reply', () => {
  it('the prompts say [make <kind>] only when the chat can make', () => {
    expect(batiOneCallRules('ja', { make: true })).toContain('[make 種類]');
    expect(batiOneCallRules('ja', {})).not.toContain('[make');
    expect(batiSort({ make: true })).toContain('"make <kind>"');
    expect(batiSort({})).not.toContain('make <kind>');
  });
  it('reads the tag (one call) and the sorting word (two calls)', () => {
    expect(parseTagged('[make art]\nわかった！')).toMatchObject({ kind: 'normal', want: 'make', make: 'art', body: 'わかった！' });
    expect(parseTagged('[{"e":"smile"}][make song] いいね')).toMatchObject({ want: 'make', make: 'song' });
    expect(parseTagged('[make spaceship]\nうん')).toEqual({ kind: 'normal', body: 'うん' });
    expect(readSort('make art')).toEqual({ kind: 'normal', want: 'make', make: 'art' });
    expect(readSort('make: video')).toEqual({ kind: 'normal', want: 'make', make: 'video' });
    expect(readSort('worry')).toEqual({ kind: 'worry' });
    expect(makeKindOf('picture')).toBe('art');
    expect(makeKindOf('pizza')).toBeUndefined();
  });
  it('two calls: the sorting sees the turns before (a follow-up is the earlier request), and the answer says make', async () => {
    const { llm, sent } = twoCall('make art');
    const history = [
      { role: 'user' as const, text: 'ヤッホー画像を作って欲しいんだけど空飛ぶクジラが光々しく舞い降りるような' },
      { role: 'assistant' as const, text: 'どんな絵にする？' },
      { role: 'user' as const, text: '魔法で作って欲しい' },
    ];
    const r = await buddyAnswer(llm, ctx, history, undefined, { make: true });
    expect(r.make).toBe('art');
    const sort = sent.find((x) => x.maxOutputTokens === 50)!;
    expect(sort.history[0].text).toContain('空飛ぶクジラ');
    expect(sort.history[0].text).toContain('魔法で作って欲しい');
    // the answer itself gets the whole history
    expect(sent.find((x) => x.maxOutputTokens !== 50)!.history).toHaveLength(3);
  });
  it('without `make` the sorting reads the last message only and nothing is made', async () => {
    const { llm, sent } = twoCall('make art');
    const r = await buddyAnswer(llm, ctx, [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }, { role: 'user', text: '絵を作って' }], undefined, {});
    expect(r.make).toBeUndefined();
    expect(sent.find((x) => x.maxOutputTokens === 50)!.history[0].text).toBe('絵を作って');
    expect(sortInput([{ role: 'user', text: 'only' }])).toBe('only');
  });
  it('one call: [make art] comes back as make with its short line', async () => {
    const llm: LlmProvider = { name: 'one', oneCall: true, chat: async () => '[make art]\nまかせて！' };
    const r = await buddyAnswer(llm, ctx, [{ role: 'user', text: 'イラストほしい' }], undefined, { make: true });
    expect(r).toMatchObject({ make: 'art', text: 'まかせて！', kind: 'normal' });
  });
});
