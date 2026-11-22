import { describe, expect, it } from 'vitest';
import { parseTagged, readFaceTag, TaggedSplitter } from './buddy';
import { batiOneCallRules } from './prompts/bati';

describe('M-R234 the expression on the first line', () => {
  it('reads the face and the motion before the kind', () => {
    expect(parseTagged('{smile hop}[normal]\n土星の輪は氷だよ！')).toEqual({ kind: 'normal', body: '土星の輪は氷だよ！', face: 'smile', motion: 'hop' });
    expect(parseTagged('{sad}[worry]\nつらいよね。')).toEqual({ kind: 'worry', body: 'つらいよね。', face: 'sad' });
    expect(parseTagged('{thinking none}[search]')).toEqual({ kind: 'normal', body: '', want: 'search', face: 'thinking' });
  });
  it('drops unknown words and leaves answers without a tag alone', () => {
    expect(readFaceTag('{angry jump}[normal]\nx')).toEqual({ rest: '[normal]\nx' });
    expect(parseTagged('[normal]\nやあ')).toEqual({ kind: 'normal', body: 'やあ' });
  });
  it('streams the answer without the tag', () => {
    const got: string[] = [];
    const s = new TaggedSplitter((t) => got.push(t));
    for (const p of ['{sur', 'prised lean}', '[nor', 'mal]\n', 'えっ、本当に！？　すごいね。', 'もっと聞かせて。']) s.push(p);
    expect(s.face).toBe('surprised');
    expect(s.motion).toBe('lean');
    expect(got.join('')).toBe('えっ、本当に！？　すごいね。もっと聞かせて。');
  });
  it('asks for it in the one-call rules', () => {
    expect(batiOneCallRules('ja')).toContain('[{"e":"smile","m":"hop"},{"e":"sad","m":"none"}][normal]');
  });
});

describe('M-R238 sentence by sentence', () => {
  it('reads the JSON array of beats before the kind', async () => {
    const p = parseTagged('[{"e":"smile","m":"hop"},{"e":"sad","m":"none"}][normal]\nやったー！ でも、ちょっと不安かも……');
    expect(p.kind).toBe('normal');
    expect(p.body).toBe('やったー！ でも、ちょっと不安かも……');
    expect(p.faces).toEqual([{ face: 'smile', motion: 'hop' }, { face: 'sad' }]);
    expect(p.face).toBe('smile');
  });
  it('streams without the array', () => {
    const got: string[] = [];
    const s = new TaggedSplitter((t) => got.push(t));
    for (const x of ['[', '{"e":"surp', 'rised","m":"lean"}', ',{"e":"smile"}]', '[normal]\n', 'えっ、本当に！？　すごいね。', 'もっと聞かせて。']) s.push(x);
    expect(s.faces).toEqual([{ face: 'surprised', motion: 'lean' }, { face: 'smile' }]);
    expect(got.join('')).toBe('えっ、本当に！？　すごいね。もっと聞かせて。');
  });
  it('your own words: one small call, else the rules; your look stays bright', async () => {
    const { talkBeats } = await import('./talkBeats');
    const llm = { name: 'm', chat: async () => '[{"e":"sad"},{"e":"smile","m":"hop"}]' } as never;
    expect(await talkBeats(llm, 'こわかった。でも楽しかった！', { self: true })).toEqual([{ face: 'normal' }, { face: 'smile', motion: 'hop' }]);
    const down = { name: 'm', chat: async () => Promise.reject(new Error('down')) } as never;
    expect(await talkBeats(down, 'これ、なに？ すごい！')).toEqual([{ face: 'thinking', motion: 'tilt' }, { face: 'smile', motion: 'hop' }]);
  });
});

describe('M-R243 entrances, shapes and marks', () => {
  it('reads in / shape from the beats', () => {
    const p = parseTagged('[{"e":"surprised","m":"lean","in":"slam","shape":"burst"},{"e":"thinking","in":"slow","shape":"cloud"}][normal]\n!!マジで！？!!　……どうしよう。');
    expect(p.faces).toEqual([{ face: 'surprised', motion: 'lean', in: 'slam', shape: 'burst' }, { face: 'thinking', in: 'slow', shape: 'cloud' }]);
  });
  it('keeps the marked words from the small call only when nothing but the marks changed', async () => {
    const { talkBeatsMarked } = await import('./talkBeats');
    const good = { name: 'm', chat: async () => '[{"e":"smile","in":"shake","t":"^^やった^^！"},{"e":"normal","t":"また明日。"}]' } as never;
    expect(await talkBeatsMarked(good, 'やった！　また明日。')).toEqual({ faces: [{ face: 'smile', in: 'shake' }, { face: 'normal' }], marked: '^^やった^^！　また明日。' });
    const sneaky = { name: 'm', chat: async () => '[{"e":"smile","t":"<b>やった</b>！"}]' } as never;
    expect((await talkBeatsMarked(sneaky, 'やった！')).marked).toBeUndefined();
  });
});

describe('M-R244 the cuts from the same call', () => {
  it('passes br on, and punctuates spoken words without changing them', async () => {
    expect(parseTagged('[{"e":"smile"},{"e":"normal","br":true}][normal]\nいち。に。').faces).toEqual([{ face: 'smile' }, { face: 'normal', br: true }]);
    const { talkBeatsMarked } = await import('./talkBeats');
    const llm = { name: 'm', chat: async () => '[{"e":"smile","t":"きょうは楽しかった。"},{"e":"normal","br":true,"t":"またあしたね！"}]' } as never;
    const r = await talkBeatsMarked(llm, 'きょうは楽しかった またあしたね');
    expect(r.marked).toBe('きょうは楽しかった。またあしたね！');
    expect(r.faces[1]).toEqual({ face: 'normal', br: true });
    const changed = { name: 'm', chat: async () => '[{"e":"smile","t":"今日は楽しかった。"},{"e":"normal","t":"また明日ね！"}]' } as never;
    expect((await talkBeatsMarked(changed, 'きょうは楽しかった またあしたね')).marked).toBeUndefined();
  });
});
