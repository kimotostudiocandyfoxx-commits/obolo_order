import { describe, expect, it } from 'vitest';
import { DAY1 } from './day1';
import { bgmAt, fill, labelIndex, mediaAt } from './script';

describe('day 1 script', () => {
  it('every goto/choice target exists', () => {
    for (const s of DAY1) {
      if (s.t === 'goto') expect(() => labelIndex(DAY1, s.id)).not.toThrow();
      if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(DAY1, o.goto!)).not.toThrow();
    }
  });
  it('starts with motion 1 and ends with end', () => {
    expect(DAY1.find((s) => s.t === 'video')).toEqual({ t: 'video', motion: 1 });
    expect(DAY1[DAY1.length - 1]).toEqual({ t: 'end' });
  });
  it('asks the name exactly once', () => {
    expect(DAY1.filter((s) => s.t === 'name')).toHaveLength(1);
  });
  it('fills placeholders', () => {
    expect(fill('{name}へ by {inviter}', { name: 'ユウ', inviter: 'KIMORIN' })).toBe('ユウへ by KIMORIN');
  });
  it('restores the right background when resuming', () => {
    const i = DAY1.findIndex((s) => s.t === 'action' && s.label === '本部へ向かう');
    expect(mediaAt(DAY1, i)).toEqual({ motion: 4, loop: true });
  });
  it('every BGM track has a file and the music is set from the first step', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    for (const s of DAY1) if (s.t === 'bgm' && s.track) expect(fs.existsSync(`public/onboarding/bgm-${s.track}.m4a`)).toBe(true);
    expect(bgmAt(DAY1, 1)).toBe('video11');
    expect(bgmAt(DAY1, DAY1.length - 1)).toBe('3');
  });
  it('lets the visitor read during motion 17, with 19 chained after it', () => {
    const i = DAY1.findIndex((s) => s.t === 'bgvideo');
    expect(DAY1[i]).toEqual({ t: 'bgvideo', motion: 17, then: [19] });
    expect(DAY1[i + 1]).toMatchObject({ t: 'say', text: expect.stringContaining('何かの偶然') });
    // resuming during those lines shows 19's last frame
    expect(mediaAt(DAY1, i + 3)).toEqual({ motion: 19, loop: false });
  });
  it('MONBAN shouts on a black screen before motion 27', () => {
    const i = DAY1.findIndex((s) => s.t === 'say' && s.text === 'おい！待て！');
    expect(DAY1[i - 1]).toEqual({ t: 'black' });
    expect(DAY1[i + 1]).toEqual({ t: 'video', motion: 27 });
    expect(mediaAt(DAY1, i)).toBeNull();
  });
});
