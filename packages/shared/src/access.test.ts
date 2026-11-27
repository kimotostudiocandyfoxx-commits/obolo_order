import { describe, expect, it } from 'vitest';
import {
  BATI_NO_MANA_LINES,
  BATI_TIRED_LINES,
  batiChatGate,
  batiRestLine,
  dachiCapped,
  onFirstJourney,
  outOfMana,
  smallCostEstimates,
  stoppedAtZero,
} from './access';
import { BATI_PERSONALITY_IDS, hasBannedBatiWord } from './batiPersona';

const resident = { member: false, journeyDay: 12, journeyCompletedAt: null, balance: 0 };
const member = { member: true, journeyDay: 12, journeyCompletedAt: null, balance: 0 };

describe('R18 access at 0 mana', () => {
  it('the first journey never stops (day 8 finished = past it)', () => {
    expect(onFirstJourney({ journeyDay: 3 })).toBe(true);
    expect(onFirstJourney({ journeyDay: 11, journeyCompletedAt: null })).toBe(true);
    expect(onFirstJourney({ journeyDay: 11, journeyCompletedAt: new Date() })).toBe(false);
    expect(onFirstJourney({ journeyDay: 12 })).toBe(false);
    expect(outOfMana({ ...resident, journeyDay: 5 })).toBe(false);
  });
  it('a non-member past the journey at 0 is out of mana; with mana or as a member not', () => {
    expect(outOfMana(resident)).toBe(true);
    expect(outOfMana({ ...resident, balance: 1 })).toBe(false);
    expect(outOfMana(member)).toBe(false);
  });
  it("{bati}'s chat: non-member at 0 → noMana; member at 0 → allowed until the day's cap, then tired", () => {
    expect(batiChatGate(resident, 0)).toEqual({ allow: false, rest: 'noMana' });
    expect(batiChatGate(member, 0, 300)).toEqual({ allow: true });
    expect(batiChatGate(member, 299, 300)).toEqual({ allow: true });
    expect(batiChatGate(member, 300, 300)).toEqual({ allow: false, rest: 'tired' });
    expect(batiChatGate({ ...resident, balance: 5 }, 500, 300)).toEqual({ allow: true });
  });
  it('ダチ: non-members have a soft daily cap, members none', () => {
    expect(dachiCapped(false, 200, 200)).toBe(false);
    expect(dachiCapped(false, 201, 200)).toBe(true);
    expect(dachiCapped(true, 10_000, 200)).toBe(false);
  });
  it('what stops at 0: the making-side writes; viewing, ダチ, the chat itself and the wallet do not', () => {
    for (const p of ['/moon/spell', '/moon/lyrics', '/moon/compass', '/moon/novel/chapter', '/buddy/compass', '/buddy/picture', '/compose/songs/x/edit', '/mars/mv/x/render', '/voice/speak'])
      expect(stoppedAtZero('POST', p), p).toBe(true);
    for (const p of ['/dachi/threads/x/messages', '/buddy/chat', '/buddy/chat/stream', '/wallet', '/me/journey/complete', '/voice/bati-says', '/moon/works', '/media/voice'])
      expect(stoppedAtZero('POST', p), p).toBe(false);
    expect(stoppedAtZero('GET', '/compose/songs')).toBe(false);
    expect(stoppedAtZero('GET', '/mars/mv/x')).toBe(false);
  });
  it("{bati}'s lines exist for every style, mild, with the 88 mana", () => {
    for (const p of BATI_PERSONALITY_IDS) {
      expect(BATI_NO_MANA_LINES[p]).toMatch(/88マナ/);
      expect(BATI_NO_MANA_LINES[p]).toMatch(/オボロオーダー/);
      expect(BATI_TIRED_LINES[p]).toMatch(/明日/);
      expect(hasBannedBatiWord(BATI_NO_MANA_LINES[p] + BATI_TIRED_LINES[p])).toBe(false);
    }
    expect(batiRestLine('noMana')).toBe('マナがなくなっちゃった…。オボロオーダーになると、毎月88マナが湧くよ。');
    expect(batiRestLine('noMana', 'kansai')).toContain('湧くで');
    expect(batiRestLine('tired', 'unknown-style')).toBe(BATI_TIRED_LINES.genki);
  });
  it('the cost of one message (estimates)', () => {
    const e = smallCostEstimates(160, 0.01);
    // a ダチ text: well under a hundredth of a yen
    expect(e.dachiTextJpy).toBeGreaterThan(0);
    expect(e.dachiTextJpy).toBeLessThan(0.01);
    expect(e.dachiVoiceJpy).toBeLessThan(0.05);
    // {bati}'s reply ≈ ¥0.1 (text), well under ¥1 read aloud
    expect(e.batiReplyJpy).toBeGreaterThan(0.05);
    expect(e.batiReplyJpy).toBeLessThan(0.2);
    expect(e.batiReplyVoicedJpy).toBeLessThan(1);
    expect(e.kimorinVoicedJpy).toBeGreaterThan(e.kimorinTextJpy);
  });
});
