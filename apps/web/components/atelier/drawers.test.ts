import { describe, expect, it } from 'vitest';
import { MOON_ZONES } from '../../lib/talk/zones';
import { batiTalkPlace, TEMPLE_PLATE } from './temple';
import { BATI_THREAD, dachiLinkOf, threadsInDrawer, type ThreadInfo } from './threads';

// what useDachiThreads gives a user from D04-S005c (day 3) on: the inviter (or MIKIE⭐︎DRILL's welcome), KIMORIN⭐︎, others
const DACHI: ThreadInfo[] = [
  { id: 'mikie', name: 'MIKIE⭐︎DRILL', unread: 1, lastAt: '2026-11-20T10:00:00Z' },
  { id: 'kimorin', name: 'KIMORIN⭐︎', lastAt: '2026-11-24T10:00:00Z' },
  { id: '7d3c1e8e-0000-4000-8000-000000000001', name: 'アポロ' },
];
const BATI = { name: 'ウニュ', avatar: '/bati.webp' };

describe("the Moon tabs' ≡ (R15)", () => {
  it("{bati}'s tab lists {bati} only — no inviter, MIKIE⭐︎DRILL, KIMORIN⭐︎ or other ダチ", () => {
    const l = threadsInDrawer('bati', BATI, DACHI);
    expect(l.map((t) => t.id)).toEqual([BATI_THREAD]);
    expect(l[0].name).toBe('ウニュ');
    expect(l.some((t) => t.name.includes('MIKIE'))).toBe(false);
  });
  it('the same with an inviter who is a person, and before day 3 (KIMORIN⭐︎ alone)', () => {
    expect(threadsInDrawer('bati', BATI, [{ id: 'inviter-uuid', name: 'ともだち' }, ...DACHI]).map((t) => t.id)).toEqual([BATI_THREAD]);
    expect(threadsInDrawer('bati', BATI, [DACHI[1]]).map((t) => t.id)).toEqual([BATI_THREAD]);
  });
  it('the ダチ tab lists every ダチ (MIKIE⭐︎DRILL and KIMORIN⭐︎ too), never {bati}', () => {
    const l = threadsInDrawer('dachi', BATI, [{ id: BATI_THREAD, name: 'ウニュ' }, ...DACHI]);
    expect(l.map((t) => t.id)).toEqual(['mikie', 'kimorin', DACHI[2].id]);
  });
  it('a ?thread=<a ダチ> link goes to the ダチ tab; bati / none stay in {bati}', () => {
    expect(dachiLinkOf('mikie')).toBe('mikie');
    expect(dachiLinkOf(BATI_THREAD)).toBeNull();
    expect(dachiLinkOf(null)).toBeNull();
  });
});

describe("a past {bati} talk's place (R15)", () => {
  it('is the temple with the bowl, {bati} in front of it — not the old Moon picture', () => {
    const p = batiTalkPlace();
    expect(p.place).toBe(MOON_ZONES.bati);
    expect(p.place).toBe(TEMPLE_PLATE.src);
    // the old Moon picture (lib/talk/looks.ts PLACE_BG.moon)
    expect(p.place).not.toBe('/talk/bg-moon.webp');
    expect(p.placeAspect).toBe(TEMPLE_PLATE.aspect);
    expect(p.otsStand).toBe(TEMPLE_PLATE.batiFront);
  });
});
