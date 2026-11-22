import { kororinRing, selfFace, talkExpression } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { DAY3 } from '../onboarding/day3';
import { labelIndex, type Step } from '../onboarding/script';
import { demoBatiTalkLook, demoNeoTalkLook } from './demoLooks';

/** the steps played from a label until `stop` (following gotos and the voice-reply branch) */
function walk(steps: Step[], from: number, reply: string, stop: (s: Step) => boolean): Step[] {
  const out: Step[] = [];
  for (let i = from, n = 0; i < steps.length && n < 200; n++) {
    const s = steps[i];
    out.push(s);
    if (stop(s)) break;
    if (s.t === 'goto') i = labelIndex(steps, s.id);
    else if (s.t === 'branch' && s.key === 'f_d04_voice_reply') i = labelIndex(steps, s.cases[reply] ?? s.otherwise);
    else i++;
  }
  return out;
}

describe('M-R233 the ring becomes コロリン at D04-S005c', () => {
  const dv = DAY3.findIndex((s) => s.t === 'dachivoice');
  for (const reply of ['reply', 'later'])
    it(`plays the switch and its lines (${reply})`, () => {
      const seen = walk(DAY3, dv + 1, reply, (s) => s.t === 'scene');
      const fx = seen.findIndex((s) => s.t === 'fx' && s.fx === 'kororin-ring');
      expect(fx).toBeGreaterThan(0);
      expect(seen[fx + 1]).toEqual({ t: 'set', key: 'f_kororin_ring', value: 'true' });
      const said = seen.flatMap((s) => (s.t === 'say' ? [s.text] : []));
      expect(said).toContain('見て見て！　話した言葉が、ぜんぶ、コロリンになった！');
      expect(said).toContain('……私の言葉は、コロリンになっても、可愛いですね。');
      expect(said.includes('……私にも、送っていいですよ。返事は、気が向いたら、しますので。')).toBe(reply === 'later');
    });
  it('is kept with the day (and any later day shows it)', () => {
    expect(kororinRing({ journeyDay: 3, story: { 'd3.f_kororin_ring': 'true' } })).toBe(true);
    expect(kororinRing({ journeyDay: 3, story: {} })).toBe(false);
    expect(kororinRing({ journeyDay: 4 })).toBe(true);
  });
});

describe('M-R234 / M-R235 the looks in the talk', () => {
  it('falls back to the nearest face, then the standing figure', () => {
    const look = { stand: 's.png', faces: { smile: { kind: 'image' as const, url: 'smile.png' } } };
    expect(talkExpression(look, 'shy')).toEqual({ kind: 'image', url: 'smile.png' });
    expect(talkExpression(look, 'sad')).toEqual({ kind: 'image', url: 's.png' });
    expect(talkExpression(null)).toBeNull();
  });
  it('keeps your own face gentle, or plain with 「表情を変えない」', () => {
    expect(selfFace('sad')).toBe('normal');
    expect(selfFace('shy')).toBe('shy');
    expect(selfFace('smile', true)).toBe('normal');
  });
  it('gives the demo looks real swap parts (eyes closed, mouth open) at their boxes', () => {
    for (const look of [demoNeoTalkLook('a'), demoBatiTalkLook('b')]) {
      const n = look.faces?.normal;
      expect(n?.kind).toBe('image');
      if (n?.kind !== 'image') return;
      expect(n.blink && n.mouth).toBeTruthy();
      expect(n.eyesBox!.y).toBeLessThan(n.mouthBox!.y);
    }
    // your own: only the gentle four
    expect(Object.keys(demoNeoTalkLook('a').faces ?? {}).sort()).toEqual(['normal', 'shy', 'smile', 'surprised']);
  });
});

describe('M-R238 faces from the words, sentence by sentence', () => {
  it('follows the rules when no AI can be had', async () => {
    const { ruleBeats, talkSentences } = await import('@obolo/shared');
    expect(talkSentences('やったー！　でも、ちょっと不安かも……')).toEqual(['やったー！', 'でも、ちょっと不安かも……']);
    expect(ruleBeats('やったー！　でも、ちょっと不安かも……')).toEqual([{ face: 'smile', motion: 'hop' }, { face: 'sad' }]);
    expect(ruleBeats('これ、なに？')).toEqual([{ face: 'thinking', motion: 'tilt' }]);
    expect(ruleBeats('えっ、本当！？')).toEqual([{ face: 'surprised', motion: 'lean' }]);
    expect(ruleBeats('ふふ笑')).toEqual([{ face: 'smile' }]);
    expect(ruleBeats('そうなんだ。')).toEqual([{ face: 'normal' }]);
    // your own look: a dark sentence stays plain
    expect(ruleBeats('ちょっと不安……', true)).toEqual([{ face: 'normal' }]);
  });
});
