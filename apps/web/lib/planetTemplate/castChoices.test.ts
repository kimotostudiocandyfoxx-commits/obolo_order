import { CAST_OSHI_KEYS, type HomeWork, type PlanetHomeView } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { choicesOf, NO_CHOICES, residentOf, toggled, unoshiAround, withoutUnoshi } from './castChoices';
import { castOn, castWorkId, withCast } from './castWorks';
import { dachiOf, oshiOn, ROSTER_LAST_DAY } from './roster';

const real = (id: string, rel: HomeWork['rel'] = 'oshi'): HomeWork => ({ id: `w-${id}`, kind: 'book', author: { id, name: id, pic: null }, rel, flownAt: '2026-11-28T00:00:00Z', text: '' }) as HomeWork;
const view = (around: HomeWork[]): PlanetHomeView => ({ planet: 'pluto', live: true, owner: { id: 'me', name: 'me' }, own: [], around, far: [] }) as unknown as PlanetHomeView;

describe('client 2026-11-28: the residents are oshi from the start; ♡ off sends one away; ☆ keeps a cast work', () => {
  it('the residents are the roster’s oshi (the eighteen, after the journey) — the two ダチ are not', () => {
    expect([...CAST_OSHI_KEYS].sort()).toEqual(oshiOn(ROSTER_LAST_DAY).map((p) => p.pic).sort());
    for (const d of dachiOf(true)) expect(residentOf(`cast-${d.pic}`), d.name).toBeNull();
    expect(residentOf('cast-croco')).toBe('croco');
    expect(residentOf('some-member-uuid')).toBeNull();
    // every resident in the roster comes as oshi (♡ on) until the member says otherwise
    expect(castOn({ day: ROSTER_LAST_DAY, ordered: false }).filter((x) => x.rel === 'oshi')).toHaveLength(18);
  });

  it('♡ off: the resident’s work leaves the home; real friends and the other cast stay, in their order', () => {
    const v = withCast(view([real('friend-1'), real('friend-2', 'dachi')]), { day: ROSTER_LAST_DAY, ordered: false });
    const shown = withoutUnoshi(v, new Set(['croco', 'sapon']));
    const ids = shown.around.map((w) => w.author.id);
    expect(ids.slice(0, 2), 'real friends first (the 8 seats)').toEqual(['friend-1', 'friend-2']);
    expect(ids).not.toContain('cast-croco');
    expect(ids).not.toContain('cast-sapon');
    expect(ids).toContain('cast-kimorin');
    expect(shown.around).toHaveLength(v.around.length - 2);
    expect(unoshiAround(v, new Set(['croco'])).map((w) => w.id)).toEqual([castWorkId('croco', 'pluto')]);
    expect(withoutUnoshi(v, new Set())).toBe(v);
  });

  it('choices from the server (only known keys and cast work ids) and changed at once on the screen', () => {
    const c = choicesOf({ unoshi: ['croco', 'nobody' as never], saved: [{ id: 'cast-croco-pluto', savedAt: 'x' }, { id: 'w-1', savedAt: 'x' }] });
    expect([...c.unoshi]).toEqual(['croco']);
    expect([...c.saved]).toEqual(['cast-croco-pluto']);
    expect(choicesOf(null)).toBe(NO_CHOICES);
    const back = toggled(c, { oshi: 'croco', on: true });
    expect(back.unoshi.has('croco')).toBe(false);
    expect(c.unoshi.has('croco'), 'not changed in place').toBe(true);
    expect(toggled(c, { save: 'cast-croco-pluto', on: false }).saved.size).toBe(0);
    expect(toggled(NO_CHOICES, { save: 'cast-sapon-saturn', on: true }).saved.has('cast-sapon-saturn')).toBe(true);
  });
});
