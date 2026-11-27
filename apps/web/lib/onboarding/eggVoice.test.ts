import { BATI_VOICE_EXPLAIN, BATI_VOICE_TARGET_SECONDS, CONSENT_POINTS } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { DAY1 } from './day1';
import { DAY2 } from './day2';
import { afterTake, ringDash, ringProgress } from './eggVoice';

describe('たまごに声を聞かせる (D03-S005, M-R246 / M-R247)', () => {
  it('the ring fills with the length spoken: half at 5 s, full at 10 s, never past full', () => {
    expect(BATI_VOICE_TARGET_SECONDS).toBe(10);
    expect(ringProgress(5)).toBe(0.5);
    expect(ringProgress(14)).toBe(1);
    expect(ringDash(5, 100)).toBe('50.00 100.00');
  });

  it('let go too soon → more (appended); full → on', () => {
    expect(afterTake(3.2)).toBe('short');
    expect(afterTake(3.2 + 6.9)).toBe('full');
  });

  it('day 2 (M-R334): the voice comes after {bati} is born and named — OBOLON’s two lines, the mic, then {bati} has learnt it; the short line verbatim', () => {
    const at = DAY2.findIndex((s) => s.t === 'eggvoice');
    const hatch = DAY2.findIndex((s) => s.t === 'hatch');
    const named = DAY2.findIndex((s) => s.t === 'batiname');
    expect(hatch).toBeGreaterThan(0);
    expect(named).toBeGreaterThan(hatch);
    expect(at).toBeGreaterThan(named);
    expect(DAY2[at - 2]).toEqual({ t: 'say', who: 'OBOLON', text: '{bati}は、、、お前の声を、真似して、喋る。' });
    expect(DAY2[at - 1]).toEqual({ t: 'say', who: 'OBOLON', text: 'だから、、、お前の声を、聞かせてやれ。' });
    expect(DAY2.slice(at).find((s) => s.t === 'say')).toEqual({ t: 'say', who: 'バティ', text: '{name}の声、おぼえたよ！' });
    // KIMORIN's 「何と話しかければ」 passage is gone
    expect(DAY2.some((s) => s.t === 'say' && s.text.includes('なんて話しかければいいか'))).toBe(false);
    const step = DAY2[at] as Extract<(typeof DAY2)[number], { t: 'eggvoice' }>;
    expect(step.short).toEqual({ t: 'say', who: 'OBOLON', text: '、、、もう少し、聞かせてやれ。' });
    expect(step.example).toBe('よろしくね。いっしょに、いろんな星に行こう。');
    // M-R247: no explanation in the scene (only the ⓘ) — the consent words are not a line or a notice of the story
    expect(JSON.stringify(DAY2)).not.toContain('相方の声のためだけに使い');
    expect(BATI_VOICE_EXPLAIN).toBe('あなたの声は、相方の声のもとになります（少し高くして使います）。相方の声のためだけに使い、ほかには使いません。あとで設定から消せます');
  });

  it('M-R250 / M-R334: under 13 the photo passage is skipped — OBOLON asks for the wished look instead (the branch f_media no)', () => {
    const b = DAY2.find((s) => s.t === 'branch' && s.key === 'f_media') as Extract<(typeof DAY2)[number], { t: 'branch' }>;
    expect(b.cases.no).toBe('look-wish');
    const at = (id: string) => DAY2.findIndex((s) => s.t === 'label' && s.id === id);
    const photo = DAY2[at('look-photo') + 1];
    expect(photo).toEqual({ t: 'say', who: 'OBOLON', text: 'まず、、、お前の姿を、器の水に映せ。' });
    expect(DAY2[at('look-photo') + 2]).toEqual({ t: 'goto', id: 'look-make' });
    expect(DAY2[at('look-wish') + 1]).toEqual({ t: 'say', who: 'OBOLON', text: '、、、器の水に、なりたい姿を、思い浮かべろ。' });
    expect(DAY2.slice(at('look-make')).find((s) => s.t === 'pick4')).toBeTruthy();
  });

  it('day 1 asks for no photo and no voice registration (dictated answers only)', () => {
    const asks = DAY1.filter((s) => ['look', 'pick4', 'evolve', 'eggvoice', 'dachivoice', 'atelier', 'egg'].includes(s.t));
    expect(asks).toEqual([]);
    expect(JSON.stringify(DAY1)).not.toMatch(/写真|録音|声の登録/);
  });

  it('the start-of-app agreement says what photos and voice are for, and that they can be deleted', () => {
    const all = CONSENT_POINTS.join('');
    expect(all).toContain('利用規約');
    expect(all).toContain('プライバシーポリシー');
    expect(all).toMatch(/写真と声は、あなたの姿と相方/);
    expect(all).toContain('ほかのことには使いません');
    expect(all).toContain('設定からいつでも消せます');
  });
});
