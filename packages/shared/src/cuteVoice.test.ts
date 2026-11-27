import { describe, expect, it } from 'vitest';
import { defaultVoiceSilent } from './access';
import { CUTE_VOICE_RATE, CUTE_VOICE_WORDS, cuteVoiceBytes, cuteVoiceCostJpy, cuteVoiceCostParts, cuteVoiceMana, cuteVoiceMissWords, cuteVoiceRate } from './cuteVoice';
import { SendDachiMessageBody } from './dachiVoice';
import { CUTE_VOICE_QUOTE_CHARS, DEFAULT_COST_RATES, FISH_USD_PER_MBYTE, isMakeKind, isTenthMana, MAKE_COST, MAKE_COST_ESTIMATE, estimateJpy, manaFor10, quoteMana, usageLineOf } from './manaPrice';

describe('the price of words read by the default cute voice (client 2026-11-27)', () => {
  it('the cost is per spoken byte (Fish + the files kept) plus the mood and the mix once', () => {
    const p = cuteVoiceCostParts();
    // Fish: $15 per 1M bytes at 160 JPY — ¥0.0072 a Japanese character; the kept files add a little
    expect(p.perByteJpy).toBeGreaterThan((FISH_USD_PER_MBYTE / 1e6) * 160);
    expect(p.perByteJpy * 3).toBeCloseTo(0.0073, 3);
    expect(p.baseJpy).toBeCloseTo(0.0153, 3);
    expect(cuteVoiceBytes('あいう')).toBe(9);
    expect(cuteVoiceBytes('  あ\nい ')).toBe(cuteVoiceBytes('あ い'));
    expect(cuteVoiceCostJpy('あいう')).toBeCloseTo(p.baseJpy + 9 * p.perByteJpy, 10);
  });

  it('THE rule: ceil( yen ÷ 0.964 × 1.08 × 10 ) / 10 on these words, a tenth at least', () => {
    for (const n of [1, 5, 11, 12, 20, 40, 100, 200, 300]) {
      const text = 'あ'.repeat(n);
      const byRule = Math.ceil((cuteVoiceCostJpy(text) / 0.964) * 1.08 * 10 - 1e-8) / 10;
      expect(cuteVoiceMana(text)).toBe(Math.max(0.1, byRule));
      expect(cuteVoiceMana(text)).toBe(quoteMana(cuteVoiceCostJpy(text)));
      expect(isTenthMana(cuteVoiceMana(text))).toBe(true);
    }
    expect(['あ'.repeat(10), 'あ'.repeat(20), 'あ'.repeat(40), 'あ'.repeat(100), 'あ'.repeat(300)].map((t) => cuteVoiceMana(t))).toEqual([0.1, 0.2, 0.4, 0.9, 2.5]);
    expect(cuteVoiceMana('')).toBe(0);
    expect(cuteVoiceMana('   ')).toBe(0);
  });

  it('the live rates move it: a weaker yen costs more', () => {
    const weak = cuteVoiceRate({ ...DEFAULT_COST_RATES, usdJpy: 200 });
    expect(weak.manaPerByte).toBeGreaterThan(CUTE_VOICE_RATE.manaPerByte);
    expect(cuteVoiceMana('あ'.repeat(100), weak)).toBeGreaterThan(cuteVoiceMana('あ'.repeat(100)));
  });

  it('a MakeKind of its own: the list’s number is the p90 message, filed with the talk and voice line', () => {
    expect(isMakeKind('cuteVoice')).toBe(true);
    expect(MAKE_COST.cuteVoice).toBe(manaFor10(estimateJpy(MAKE_COST_ESTIMATE.cuteVoice)));
    expect(MAKE_COST.cuteVoice).toBe(cuteVoiceMana('あ'.repeat(CUTE_VOICE_QUOTE_CHARS)));
    expect(MAKE_COST.cuteVoice).toBe(0.4);
    expect(usageLineOf('cuteVoice')).toBe('usage');
  });

  it('the send body carries the switch; the lines are calm ones', () => {
    expect(SendDachiMessageBody.parse({ text: 'やあ', spoken: true })).toEqual({ text: 'やあ', spoken: true });
    expect(SendDachiMessageBody.parse({ text: 'やあ' })).toEqual({ text: 'やあ' });
    expect(cuteVoiceMissWords('noMana')).toBe(CUTE_VOICE_WORDS.noMana);
    expect(CUTE_VOICE_WORDS.price('0.3')).toBe('−0.3');
  });
});

describe('{bati} in the default voice for a member who is not recorded: no voice at 0 mana', () => {
  it('not recorded and no mana left: silent; with mana, or recorded: as before', () => {
    expect(defaultVoiceSilent({ recorded: false, balance: 0 })).toBe(true);
    expect(defaultVoiceSilent({ recorded: false, balance: 0.9 })).toBe(true);
    expect(defaultVoiceSilent({ recorded: false, balance: 1 })).toBe(false);
    expect(defaultVoiceSilent({ recorded: true, balance: 0 })).toBe(false);
  });
});
