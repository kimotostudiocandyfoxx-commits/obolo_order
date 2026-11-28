import { describe, expect, it } from 'vitest';
import { BOARD, GAME_KINDS, GAME_LABEL, GAME_SFX, newGame, rippleUniform, stepGame, tapGame } from './castGame';
import { bookSpeedOf, bookTapSide, bookTurn, BOOK_MS, BOOK_SPEEDS } from './castBook';

const mid = () => 0.5;
const run = (st: ReturnType<typeof newGame>, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) stepGame(st, 1 / 60);
};

describe('Neptune: the cast’s seven tap games (handoff 08 §3, the prototype’s sapGame / kidGame)', () => {
  it('seven kinds, each with its counter word and its own sound', () => {
    expect(GAME_KINDS).toEqual(['wobble', 'puff', 'jump', 'spin', 'ink', 'scatter', 'snap']);
    expect(GAME_LABEL).toEqual({ wobble: 'ぷるぷる', puff: 'ふわふわ', jump: 'ジャンプ', spin: 'くるくる', ink: 'スミ', scatter: 'パラパラ', snap: 'チョキ' });
    expect(new Set(Object.values(GAME_SFX)).size).toBe(7);
  });

  it('every tap counts, on every kind', () => {
    for (const kind of GAME_KINDS) {
      const st = newGame(kind);
      tapGame(st, 300, 300, mid);
      tapGame(st, 100, 500, mid);
      expect(st.count, kind).toBe(2);
    }
  });

  it('サーぽん (wobble): the place touched ripples and rings down; six ripples at most reach the shader', () => {
    const st = newGame('wobble');
    tapGame(st, 150, 450);
    expect(st.ripples[0]).toMatchObject({ x: 0.25, y: 0.75, a: 0.09 });
    for (let i = 0; i < 8; i++) tapGame(st, 300, 300);
    expect(st.ripples).toHaveLength(6);
    const u = rippleUniform(st);
    expect(u).toHaveLength(24);
    expect(u[0]).toBeCloseTo(0.5);
    run(st, 1.7);
    expect(st.ripples).toHaveLength(0);
    expect(Array.from(rippleUniform(st)).every((v) => v === 0)).toBe(true);
  });

  it('ガリみ♡ (puff): fourteen petals puff out from the touch and fade away', () => {
    const st = newGame('puff');
    tapGame(st, 200, 250);
    expect(st.parts).toHaveLength(14);
    expect(st.parts.every((p) => p.shape === 'petal' && p.x === 200 && p.y === 250)).toBe(true);
    run(st, 2.5);
    expect(st.parts).toHaveLength(0);
  });

  it('えびすけ (jump): he jumps with a back flip from the floor, lands again; a tap in the air does not jump twice', () => {
    const st = newGame('jump');
    tapGame(st, 300, 300, mid);
    expect(st.vy).toBe(760);
    expect(st.flip).toBe(1);
    run(st, 0.3);
    const h = st.h;
    expect(h).toBeGreaterThan(100);
    const vy = st.vy;
    tapGame(st, 300, 300, mid);
    expect(st.vy).toBe(vy);
    run(st, 1.2);
    expect(st.h).toBe(0);
    expect(st.vy).toBe(0);
  });

  it('ウニまる (spin): he spins to the side tapped and comes upright again', () => {
    const st = newGame('spin');
    tapGame(st, 500, 300, mid);
    expect(st.vr).toBe(9);
    tapGame(st, 100, 300, mid);
    tapGame(st, 100, 300, mid);
    expect(st.vr).toBe(-9);
    run(st, 0.5);
    expect(st.rot).toBeLessThan(0);
    run(st, 8);
    expect(Math.abs(st.rot - Math.round(st.rot / (2 * Math.PI)) * 2 * Math.PI)).toBeLessThan(0.02);
  });

  it('いかチョロ (ink): a blot where touched, he shrinks away from it and comes back to the middle', () => {
    const st = newGame('ink');
    tapGame(st, 400, 300, mid);
    expect(st.blots).toHaveLength(1);
    expect(st.tx).toBe(250);
    run(st, 0.4);
    expect(st.x).toBeLessThan(290);
    run(st, 2);
    expect(st.x).toBeCloseTo(300, 0);
    run(st, 4);
    expect(st.blots).toHaveLength(0);
  });

  it('しゃりお (scatter): eighteen grains fly up, fall and bounce on the floor', () => {
    const st = newGame('scatter');
    tapGame(st, 300, 300);
    expect(st.parts).toHaveLength(18);
    expect(st.parts.every((p) => p.shape === 'grain' && p.vy <= 0)).toBe(true);
    run(st, 1.5);
    expect(st.parts.every((p) => p.y <= 560)).toBe(true);
    expect(st.parts.some((p) => p.y > 540)).toBe(true);
  });

  it('かにぶぅ (snap): he walks sideways to where you tapped (kept on the board), bubbles rising', () => {
    const st = newGame('snap');
    tapGame(st, 20, 300, mid);
    expect(st.tx).toBe(160);
    expect(st.parts).toHaveLength(5);
    run(st, 2);
    expect(st.x).toBeCloseTo(160, 0);
    expect(st.h).toBe(0);
    tapGame(st, 420, 100, mid);
    run(st, 2);
    expect(st.x).toBeCloseTo(420, 0);
    expect(BOARD).toBe(600);
  });
});

describe('Pluto: the picture book (handoff 08 §3, the prototype’s sapBook)', () => {
  it('three reading speeds — 0.8, 1, 1.3 — remembered; anything else is ふつう', () => {
    expect(BOOK_SPEEDS.map((b) => [b.label, b.rate])).toEqual([['ゆっくり', 0.8], ['ふつう', 1], ['はやい', 1.3]]);
    expect(bookSpeedOf('1.3')).toBe(1.3);
    expect(bookSpeedOf('0.8')).toBe(0.8);
    expect(bookSpeedOf('2')).toBe(1);
    expect(bookSpeedOf(null)).toBe(1);
  });
  it('〔›〕 turns forward and past the last page the book closes; 〔‹〕 does nothing on the first', () => {
    expect(bookTurn(0, 1, 6)).toBe(1);
    expect(bookTurn(4, 1, 6)).toBe(5);
    expect(bookTurn(5, 1, 6)).toBe('finish');
    expect(bookTurn(2, 1, 3)).toBe('finish');
    expect(bookTurn(0, -1, 6)).toBeNull();
    expect(bookTurn(3, -1, 6)).toBe(2);
  });
  it('a tap on the right edge turns forward, on the left edge back, in the middle nothing', () => {
    expect(bookTapSide(320, 336)).toBe(1);
    expect(bookTapSide(20, 336)).toBe(-1);
    expect(bookTapSide(168, 336)).toBe(0);
    expect(bookTapSide(10, 0)).toBe(0);
  });
  it('the prototype’s times: a turn 0.72 s, the next page 1.1 s after one is read, the close 1.6 s after the last', () => {
    expect(BOOK_MS).toMatchObject({ turn: 720, afterTitle: 250, next: 1100, last: 1600, close: 650, fly: 1000 });
  });
});
