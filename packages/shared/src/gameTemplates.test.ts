import { describe, expect, it } from 'vitest';
import { validateGameCode } from './craft';
import { GAME_TEMPLATE_IDS, gameComplexity, gameFromTemplate, gameMakeKind, gameNeedsFull, gameTemplateList, gameTemplateParams, gameTierFor, gameTierOf, matchGameTemplate } from './gameTemplates';
import { atelierMakeCost } from './makeConfirm';
import { MAKE_COST } from './manaPrice';
import type { SpellTag } from './spell';

/** a stand-in harness: runs start / update / draw a few hundred frames with taps and keys */
function runInHarness(code: string, frames = 400) {
  const noop = () => undefined;
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'save' || k === 'restore' ? noop : typeof k === 'string' && /^[a-z]/.test(k) ? noop : undefined), set: () => true });
  const input = { left: false, right: false, up: false, down: false, action: false, x: 100, y: 300, pressed: false, tapped: false, dir: () => 0 };
  let state = 'play';
  const G: Record<string, unknown> = {
    W: 390, H: 700, ctx, score: 0, level: 2, time: 0, color: { bg: '#000', fg: '#fff', accent: '#ff0', good: '#0f0', bad: '#f00' }, input,
    addScore: (n: number) => (G.score = Math.max(0, (G.score as number) + n)),
    over: () => (state = 'over'), win: () => (state = 'won'),
    rand: (a: number, b: number) => a + Math.random() * (b - a), clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
    hit: (a: { x: number; y: number; r?: number }, b: { x: number; y: number; r?: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < ((a.r ?? 0) + (b.r ?? 0)) ** 2,
    circle: noop, rect: noop, text: noop, hero: noop,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const game = new Function(`return (${code})`)()(G);
  game.start();
  for (let f = 0; f < frames && state === 'play'; f++) {
    input.tapped = f % 7 === 0;
    input.pressed = f % 14 === 0;
    input.x = (f * 37) % 390;
    input.y = 100 + ((f * 53) % 500);
    input.right = f % 20 < 5;
    input.up = f % 30 < 3;
    G.time = (G.time as number) + 1 / 30;
    game.update(1 / 30);
    game.draw();
  }
  return { state, score: G.score as number };
}

describe('the trial game templates', () => {
  it('every template is valid code for the harness and runs', () => {
    for (const id of GAME_TEMPLATE_IDS) {
      const g = gameFromTemplate(id, null);
      expect(validateGameCode(g.code), id).toEqual({ ok: true, code: g.code });
      expect(() => runInHarness(g.code), id).not.toThrow();
      expect(g.title.length).toBeGreaterThan(0);
    }
  });
  it("the filler's values are clamped and its words made safe", () => {
    const p = gameTemplateParams('catch', { title: 'ねこ"の`ゲーム<script>', speed: 9, amount: -1, goal: 1e6, lives: 0, seconds: 'x' });
    expect(p).toMatchObject({ speed: 1.8, amount: 0.5, goal: 99, lives: 1, seconds: 0 });
    expect(p.title).not.toMatch(/["`<>]/);
    const q = gameFromTemplate('quiz', { quiz: [{ q: 'ねこの足は何本？ http://x', a: ['4本', '2本', '8本'], ok: 0 }, { q: 'a', a: ['b'] }] });
    // one usable question is too few: the template's own questions stand; the code stays valid
    expect(validateGameCode(q.code).ok).toBe(true);
    const q2 = gameFromTemplate('quiz', { quiz: Array.from({ length: 4 }, (_, i) => ({ q: `問題${i} data: url(x)`, a: ['あ', 'い', 'う'], ok: 2 })) });
    expect(validateGameCode(q2.code).ok).toBe(true);
    expect(q2.code).toContain('問題3');
  });
  it("the member's words pick a template; Bati names them all in one sentence", () => {
    expect(matchGameTemplate('クイズがいい')).toBe('quiz');
    expect(matchGameTemplate('迷路にする')).toBe('maze');
    expect(matchGameTemplate('よけるやつ')).toBe('dodge');
    expect(matchGameTemplate('3番目')).toBe('runner');
    expect(matchGameTemplate('おまかせ')).toBe('catch');
    expect(matchGameTemplate('うーん')).toBeNull();
    expect(gameTemplateList()).toMatch(/クイズ.*迷路.*どれにする？$/);
  });
});

describe('game tiers and their quotes', () => {
  const tags: SpellTag[] = [{ ja: 'よける', en: 'dodge', group: 'genre' }];
  it('first game from a template: the trial; a small request: cheap; a big one: full', () => {
    expect(gameTierFor({ recast: false, firstGame: true, template: 'quiz' })).toBe('trial');
    expect(gameTierFor({ recast: false, firstGame: false, template: 'quiz', said: '猫がよけるゲーム', tags })).toBe('cheap');
    expect(gameNeedsFull('ボスがいて、ステージが3つあって、アイテムを買えるショップがあるRPG')).toBe(true);
    expect(gameComplexity('星を集めるゲーム')).toBe(0);
  });
  it('a tweak is cheap, the full chain only after the cheap one failed twice', () => {
    expect(gameTierFor({ recast: true, said: 'ボスを出して、ステージを増やして' })).toBe('cheap');
    expect(gameTierFor({ recast: true, escalate: true })).toBe('full');
    expect(gameMakeKind(true, 'cheap')).toBe('gameTweak');
    expect(gameMakeKind(true, 'full')).toBe('gameTweakPro');
    expect(gameMakeKind(false, 'trial')).toBe('gameTrial');
    expect(gameTierOf('gamePro')).toBe('full');
  });
  it('the confirm card shows the price of the tier (the trial is the cheapest, full the dearest)', () => {
    const trial = atelierMakeCost('game', 9, false, MAKE_COST, 'trial')!;
    const cheap = atelierMakeCost('game', 9, false, MAKE_COST, 'cheap')!;
    const full = atelierMakeCost('game', 9, false, MAKE_COST, 'full')!;
    expect(trial.kind).toBe('gameTrial');
    expect(trial.mana).toBeLessThanOrEqual(3);
    expect(cheap.mana).toBeLessThan(full.mana);
    expect(trial.mana).toBeLessThan(cheap.mana);
    expect(atelierMakeCost('game', 9, true, MAKE_COST, 'full')!.kind).toBe('gameTweakPro');
  });
});
