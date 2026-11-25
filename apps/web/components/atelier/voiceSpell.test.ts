import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS, VOICE_SPELL_LINES } from '@obolo/shared';
import { isYes } from './plan';
import { voiceSpellAnswer } from './songTurn';

describe('R18: 「君の声にする魔法は、◯マナだよ。唱える？」 — the answer in words', () => {
  it('yes casts it', () => {
    for (const s of ['唱えて', 'うん、唱えて！', 'OK', 'いいよ', 'お願い', 'はい']) expect(voiceSpellAnswer(s, isYes), s).toBe('yes');
  });
  it('no drops it (nothing charged)', () => {
    for (const s of ['やめておく', 'また今度', 'いらない', 'ううん', 'やっぱりいい']) expect(voiceSpellAnswer(s, isYes), s).toBe('no');
  });
  it('other words: neither (they go on as any other)', () => {
    for (const s of ['テンポ速くして', '空の絵を描いて']) expect(voiceSpellAnswer(s, isYes), s).toBeNull();
  });
  it('the invitation never says a price; the question does, in every style', () => {
    expect(VOICE_SPELL_LINES.invite).not.toMatch(/マナ|\{n\}/);
    for (const v of Object.values(BATI_VARIANTS[VOICE_SPELL_LINES.invite])) expect(v).not.toMatch(/マナ/);
    for (const v of Object.values(BATI_VARIANTS[VOICE_SPELL_LINES.price])) expect(v).toContain('{n}マナ');
  });
});
