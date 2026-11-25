import { describe, expect, it } from 'vitest';
import { MAKE_COST } from './manaPrice';
import { JOURNEY_DONE } from './journey';
import { atelierMakeCost, confirmKey, decideCharge, MakeConfirm } from './makeConfirm';
import { FullSongBody, StickerArtBody } from './schemas';

const ok = { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f', price: MAKE_COST.song };

describe('R11: nothing that spends mana starts without a yes', () => {
  it('the price shown is the price in the config; free things have none', () => {
    expect(atelierMakeCost('song', 5)).toEqual({ kind: 'song', mana: MAKE_COST.song });
    expect(atelierMakeCost('art', 5)).toEqual({ kind: 'jacketArt', mana: MAKE_COST.jacketArt });
    expect(atelierMakeCost('video', 5)).toEqual({ kind: 'mv', mana: MAKE_COST.mv });
    for (const k of ['voice', 'radio', 'lookup', 'image']) expect(atelierMakeCost(k, JOURNEY_DONE)).toBeNull();
    // the dress-up: free on the first journey, the look's mana after it; your own look: free until it is confirmed at
    // the end of day 2, a full profileLook after it (client 2026-11-25)
    expect(atelierMakeCost('bati', 4)).toBeNull();
    expect(atelierMakeCost('look', 2)).toBeNull();
    expect(atelierMakeCost('look', 4)).toEqual({ kind: 'profileLook', mana: MAKE_COST.profileLook });
    expect(atelierMakeCost('bati', JOURNEY_DONE)).toEqual({ kind: 'look', mana: MAKE_COST.look });
    // client 2026-11-25: your own look's change covers the planet figures of the look chosen
    expect(atelierMakeCost('look', JOURNEY_DONE)).toEqual({ kind: 'profileLook', mana: MAKE_COST.profileLook });
  });
  it('no confirm where one is required: no charge', () => {
    expect(decideCharge({ kind: 'song', required: true, balance: 99, applied: false })).toEqual({ error: 'CONFIRM_REQUIRED' });
  });
  it('the price charged is the price shown (another price: nothing charged)', () => {
    expect(decideCharge({ kind: 'song', confirm: ok, required: true, balance: 99, applied: false })).toEqual({ do: 'charge', amount: ok.price });
    expect(decideCharge({ kind: 'song', confirm: { ...ok, price: 1 }, required: true, balance: 99, applied: false })).toEqual({ error: 'PRICE_CHANGED' });
    expect(decideCharge({ kind: 'mv', confirm: ok, required: true, balance: 99, applied: false })).toEqual({ error: 'PRICE_CHANGED' });
  });
  it('the same yes twice (a double tap) is one charge', () => {
    expect(decideCharge({ kind: 'song', confirm: ok, required: true, balance: 0, applied: true })).toEqual({ do: 'repeat' });
    expect(confirmKey('u1', 'song', ok)).toBe(confirmKey('u1', 'song', { ...ok }));
    expect(confirmKey('u1', 'song', ok)).not.toBe(confirmKey('u1', 'song', { ...ok, id: '00000000-0000-4000-8000-000000000000' }));
  });
  it('not enough mana: nothing charged', () => {
    expect(decideCharge({ kind: 'song', confirm: ok, required: true, balance: MAKE_COST.song - 1, applied: false })).toEqual({ error: 'NO_MANA' });
  });
  it('the request bodies carry the yes', () => {
    expect(MakeConfirm.safeParse({ id: 'x', price: 2 }).success).toBe(false);
    expect(StickerArtBody.parse({ text: '海', from: 'atelier', confirm: { ...ok, price: 3 } }).confirm?.price).toBe(3);
    expect(FullSongBody.shape.confirm).toBeDefined();
  });
});
