import { describe, expect, it } from 'vitest';
import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { BGM_LEVELS, BGM_LOOPS } from './media';
import { bgmAt, fill, labelIndex, mediaAt } from './script';

describe('day 1 script', () => {
  it('every goto/choice target exists', () => {
    for (const s of DAY1) {
      if (s.t === 'goto') expect(() => labelIndex(DAY1, s.id)).not.toThrow();
      if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(DAY1, o.goto!)).not.toThrow();
    }
  });
  it('goes from the film to motion 1 (no 「1日目」: client 2026-10-29), and ends with end', () => {
    expect(DAY1.some((s) => s.t === 'caption' && s.text === '1日目')).toBe(false);
    expect(DAY1.find((s) => s.t === 'video')).toEqual({ t: 'video', motion: '1-c' });
    expect(DAY1[DAY1.length - 1]).toEqual({ t: 'end' });
  });
  it('asks the name exactly once', () => {
    expect(DAY1.filter((s) => s.t === 'name')).toHaveLength(1);
  });
  it('fills placeholders', () => {
    expect(fill('{name}へ by {inviter}', { name: 'ユウ', inviter: 'KIMORIN' })).toBe('ユウへ by KIMORIN');
  });
  it('restores the right background when resuming', () => {
    // the invitation's words are set in code over the blank card the Seedance motion ends on
    const i = DAY1.findIndex((s) => s.t === 'action' && s.label === '本部へ向かう');
    expect(DAY1[i - 1]).toEqual({ t: 'invitation', fromMotion: true });
    expect(mediaAt(DAY1, i)).toEqual({ motion: 'd1-open', loop: false });
  });
  it('every BGM track has a file and the music is set from the first step', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    for (const s of DAY1) if (s.t === 'bgm' && s.track) expect(fs.existsSync(`public/onboarding/bgm-${s.track}.m4a`)).toBe(true);
    expect(bgmAt(DAY1, DAY1.findIndex((s) => s.t === 'bgm') + 1)).toBe('opening');
    // the client's HQ music (2026-11-28): from just before the crane reaches HQ, through MONBAN, until the temple
    expect(bgmAt(DAY1, DAY1.findIndex((s) => s.t === 'video' && s.motion === 'd1-arrive'))).toBe('d1-hq');
    expect(bgmAt(DAY1, DAY1.findIndex((s) => s.t === 'video' && s.motion === 'd1-monban') + 1)).toBe('d1-hq');
    expect(bgmAt(DAY1, DAY1.findIndex((s) => s.t === 'video' && s.motion === 12))).toBe(null);
    expect(bgmAt(DAY1, DAY1.findIndex((s) => s.t === 'name'))).toBe('obolon');
    expect(bgmAt(DAY1, DAY1.findIndex((s) => s.t === 'say' && s.text === 'おい待て、そこまでだ。'))).toBe('monban');
    expect(bgmAt(DAY1, DAY1.length - 1)).toBe('monban');
  });
  it('lets the visitor read during motion 17, with 19 chained after it (M-R200 cut 「何かの偶然…」)', () => {
    const i = DAY1.findIndex((s) => s.t === 'bgvideo' && s.motion === 17);
    expect(DAY1[i]).toEqual({ t: 'bgvideo', motion: 17, then: [19] });
    expect(DAY1.slice(i + 1).find((s) => s.t === 'say')).toMatchObject({ t: 'say', text: expect.stringContaining('Obolo Order') });
  });
  it('MONBAN steps in on a black screen, then speaks to OBOLON (no turn: client 2026-10-22)', () => {
    const i = DAY1.findIndex((s) => s.t === 'say' && s.text === 'おい待て、そこまでだ。');
    expect(DAY1[i - 1]).toEqual({ t: 'black' });
    expect(DAY1[i + 1]).toEqual({ t: 'video', motion: '27-c' });
    expect(DAY1[i + 2]).toEqual({ t: 'loop', motion: '28-l' });
    expect(DAY1[i + 3]).toMatchObject({ t: 'say', text: 'OBOLON、それは喋りすぎだ。' });
    expect(mediaAt(DAY1, i)).toBeNull();
  });
  it('loops motion 13 behind OBOLON', () => {
    const i = DAY1.findIndex((s) => s.t === 'video' && s.motion === 12);
    expect(DAY1[i + 1]).toEqual({ t: 'bgm', track: 'obolon' });
    expect(DAY1[i + 2]).toEqual({ t: 'loop', motion: 13 });
    const name = DAY1.findIndex((s) => s.t === 'name');
    expect(mediaAt(DAY1, name)).toEqual({ motion: 13, loop: true });
  });
});

describe('day 2 music (the client, 2026-11-28)', () => {
  const at = (pred: (s: (typeof DAY2)[number]) => boolean) => bgmAt(DAY2, DAY2.findIndex(pred));
  const say = (text: string) => (s: (typeof DAY2)[number]) => s.t === 'say' && s.text === text;
  it("KIMORIN's theme from his appearance until just before the Earth temple", () => {
    expect(at(say('待ちなさい。'))).toBe('monban');
    expect(at((s) => s.t === 'still' && s.shot === 'reveal-whip')).toBe('d2-kimorin');
    expect(at(say('誰だお前…。'))).toBe('d2-kimorin');
    expect(at(say('気をつけなさい。'))).toBe('d2-kimorin');
    expect(at((s) => s.t === 'still' && s.shot === 'gate-through')).toBe(null);
  });
  it('the temple music from the dark hall until KIMORIN catches on, then Crimson Pulse until he goes home', () => {
    expect(at((s) => s.t === 'still' && s.image === 's/d2-hall-dark-kimorin')).toBe('d2-temple');
    expect(at(say('……めちゃくちゃすごい！'))).toBe('d2-temple');
    expect(at(say('はい！ぜひ！'))).toBe('d2-temple');
    expect(at((s) => s.t === 'spark' && s.image === 's/d2-kimorin-pin-a')).toBe('d2-crimson');
    expect(at(say('…………。'))).toBe('d2-crimson');
    expect(at(say('宇宙行きの切符、私の家に、送っといてください。'))).toBe('d2-crimson');
    expect(at((s) => s.t === 'still' && s.shot === 'leave-gate')).toBe(null);
    expect(at((s) => s.t === 'still' && s.shot === 'plaza-wide')).toBe('launch');
  });
  it('every day-2 track has a file; the new ones have a level and loop points inside the file', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    for (const s of DAY2) if (s.t === 'bgm' && s.track) expect(fs.existsSync(`public/onboarding/bgm-${s.track}.m4a`), s.track).toBe(true);
    for (const t of ['d2-kimorin', 'd2-temple', 'd2-crimson']) {
      expect(BGM_LEVELS[t]).toBeGreaterThan(0);
      const [a, b] = BGM_LOOPS[t];
      expect(b - a).toBeGreaterThan(40);
    }
  });
});
