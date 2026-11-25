import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS } from './batiVariants';
import { NOVEL_CHAPTERS_PER_DAY } from './config';
import { MAKE_COST } from './manaPrice';
import { CRAFT_LINE_TEXTS, CRAFT_QUESTIONS, GAME_CSP, gameDocument, gameLevel, gameSystem, gameUser, novelSystem, novelUser, questionsFor, validateGameCode, chapterChars } from './craft';
import { demoChapter, demoGame } from './craftDemo';
import { canFlyHome, homePlanetOf, KIND_HOME_PLANET } from './finds';
import { JOURNEY_DONE } from './journey';
import { atelierMakeCost, decideCharge } from './makeConfirm';
import { HOME_OF_WORK } from './planetHomeConfig';
import { spellEdit, spellFrom, spellKey, spellOfAnswers, spellPrompt, SpellTags } from './spell';

const ja = (ts: { ja: string }[]) => ts.map((t) => t.ja);

describe('本 (novel): questions → spell → chapters', () => {
  it('2–4 short questions; ones the first words answered are skipped, never fewer than two', () => {
    expect(questionsFor('novel', [])).toHaveLength(3);
    expect(questionsFor('novel', ['hero']).map((q) => q.group)).toEqual(['world', 'mood']);
    expect(questionsFor('novel', ['world', 'hero', 'mood'])).toHaveLength(2);
    for (const q of [...CRAFT_QUESTIONS.novel, ...CRAFT_QUESTIONS.game]) expect(q.text).toMatch(/とか/); // examples inside the sentence
  });
  it("the answers become one spell of at most 8 talismans; {bati} fills what was not said", () => {
    const t = spellOfAnswers('novel', [
      { group: 'world', said: '魔法の森' },
      { group: 'hero', said: 'メガネの少年' },
      { group: 'mood', said: 'ちょっと切ない冒険' },
    ]);
    expect(ja(t)).toEqual(['魔法の森', 'メガネの少年', '冒険', '切ない', 'ふつうの長さ']);
    expect(t[1].en).toBe('メガネ a boy');
    expect(SpellTags.safeParse(t).success).toBe(true);
    // the free words of an answer go to the question's group
    const h = spellOfAnswers('novel', [{ group: 'hero', said: 'しゃべるペンギン' }]);
    expect(h.find((x) => x.group === 'hero')?.ja).toBe('しゃべるペンギン');
    // おまかせ: all defaults
    expect(ja(spellOfAnswers('novel', [{ group: 'world', said: 'おまかせ' }]))).toEqual(['小さな町', '女の子', 'ファンタジー', 'わくわく', 'ふつうの長さ']);
    const many = spellOfAnswers('novel', [{ said: '花火、夏、海、星、雨、雪、桜の明るい楽しい静かなお話' }, { group: 'hero', said: '猫' }]);
    expect(many.length).toBeLessThanOrEqual(8);
    expect(many.some((x) => x.group === 'world') && many.some((x) => x.group === 'length')).toBe(true);
  });
  it('a chapter is a small spell of its own (an event, a mood); the English is never shown, only sent', () => {
    const c = spellFrom('chapter', '新しい仲間が来て、ちょっと暗い感じ');
    expect(ja(c)).toEqual(['新しい仲間', '暗い']);
    expect(ja(spellFrom('chapter', 'おまかせ'))).toEqual(['おまかせ']);
    expect(spellPrompt('chapter', c)).toBe('next chapter: a new friend joins; mood: dark');
    const book = spellOfAnswers('novel', [{ group: 'world', said: '未来の街' }, { group: 'hero', said: 'ロボット' }]);
    expect(spellPrompt('novel', book)).toBe('exciting fantasy story; set in a city in the future; the hero is a small robot; chapters of about 2000 Japanese characters');
  });
  it('the writer is told the book, what happened so far, this chapter and the length', () => {
    const book = spellOfAnswers('novel', [{ group: 'world', said: '海の底' }, { group: 'hero', said: '猫' }, { group: 'mood', said: '長めで' }]);
    expect(chapterChars(book)).toEqual({ min: 2200, max: 2600 });
    const u = novelUser({ book, n: 2, before: [{ title: 'はじまり', summary: '猫が海に落ちる' }], lastText: '……泡がのぼっていった。', chapter: spellFrom('chapter', '宝さがし') });
    expect(u).toContain('第1章「はじまり」：猫が海に落ちる');
    expect(u).toContain('【この章のスペル】宝さがし');
    expect(u).toContain('第2章を書いて。本文は2200〜2600字。');
    expect(novelSystem()).toMatch(/性的な内容/);
    expect(novelUser({ book, n: 5, before: [], chapter: spellFrom('chapter', '最後の章にして') })).toContain('これが最終章。');
  });
  it('a book is free (no confirm card) and capped a day instead', () => {
    expect(atelierMakeCost('novel', JOURNEY_DONE)).toBeNull();
    expect(NOVEL_CHAPTERS_PER_DAY).toBe(20);
  });
  it('the demo has chapters for any number, filled with the spell', () => {
    const b = spellOfAnswers('novel', [{ group: 'world', said: '魔法の森' }, { group: 'hero', said: '猫' }]);
    const c1 = demoChapter(b, 1);
    expect(c1.text).toContain('魔法の森');
    expect(c1.text).toContain('猫');
    expect(c1.text.length).toBeGreaterThan(700);
    expect(demoChapter(b, 9).title).toMatch(/つづき/);
    expect(demoChapter(b, 3, true).title).toBe('あたらしい朝');
  });
});

describe('ゲーム: questions → spell (mana) → code in the harness → tweaks', () => {
  it('a game spell: genre, hero, goal, level, look — at most 8', () => {
    const t = spellOfAnswers('game', [
      { group: 'genre', said: '落ちてくる星を集めるの' },
      { group: 'hero', said: '猫で、30こ集めたら勝ち' },
      { group: 'color', said: 'ネオンでピカピカ' },
    ]);
    expect(ja(t)).toEqual(['猫', '集める', '30こ集めたら勝ち', 'ふつう', 'ネオン']);
    expect(spellPrompt('game', t)).toMatch(/^small HTML5 canvas game: collect game/);
    expect(gameLevel(t)).toBe(2);
  });
  it('「もっと難しく」 steps the level up, 「敵を増やして」 adds a rule; each tweak is a new spell (a new yes)', () => {
    const t = spellOfAnswers('game', [{ group: 'genre', said: 'よける' }]);
    const a = spellEdit('game', t, 'もっと難しく');
    expect(ja(a.added)).toEqual(['むずかしい']);
    expect(ja(a.removed)).toEqual(['ふつう']);
    const b = spellEdit('game', a.tags, 'もっと難しくして');
    expect(ja(b.added)).toEqual(['とてもむずかしい']);
    const c = spellEdit('game', b.tags, '敵を増やして');
    expect(ja(c.added)).toEqual(['敵が多い']);
    expect(spellKey('game', c.tags)).not.toBe(spellKey('game', t));
    expect(ja(spellEdit('game', t, 'もっとかんたんに').added)).toEqual(['かんたん']);
  });
  it('the first build and each tweak cost what MAKE_COST says, with the yes', () => {
    expect(MAKE_COST.gameTweak).toBeLessThan(MAKE_COST.game);
    expect(atelierMakeCost('game', 3)).toEqual({ kind: 'game', mana: MAKE_COST.game });
    expect(atelierMakeCost('game', 3, true)).toEqual({ kind: 'gameTweak', mana: MAKE_COST.gameTweak });
    // the live price list wins over the fallback
    expect(atelierMakeCost('game', 3, false, { ...MAKE_COST, game: 70 })).toEqual({ kind: 'game', mana: 70 });
    const yes = { id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f', price: MAKE_COST.game, spell: 'game-5-x' };
    expect(decideCharge({ kind: 'game', confirm: yes, required: true, balance: 999, applied: false, spell: 'game-5-x' })).toEqual({ do: 'charge', amount: MAKE_COST.game });
    expect(decideCharge({ kind: 'gameTweak', confirm: yes, required: true, balance: 999, applied: false, spell: 'game-5-x' })).toEqual({ error: 'PRICE_CHANGED' });
    expect(decideCharge({ kind: 'game', required: true, balance: 999, applied: false })).toEqual({ error: 'CONFIRM_REQUIRED' });
    // the price shown is what is charged: a price moved since the yes is refused, the same price is taken exactly
    expect(decideCharge({ kind: 'game', confirm: { ...yes, price: 70 }, required: true, balance: 999, applied: false, spell: 'game-5-x', price: 70 })).toEqual({ do: 'charge', amount: 70 });
    expect(decideCharge({ kind: 'game', confirm: yes, required: true, balance: 999, applied: false, spell: 'game-5-x', price: 70 })).toEqual({ error: 'PRICE_CHANGED' });
  });
  it('the code is checked: network, eval, other windows, html, endless loops and size are refused', () => {
    const ok = 'function game(G) { var x = 0; return { start: function () { x = 0; }, update: function (dt) { x += dt; }, draw: function () { G.circle(x, 10, 5); } }; }';
    expect(validateGameCode(ok)).toEqual({ ok: true, code: ok });
    expect(validateGameCode('```js\n' + ok + '\n```')).toEqual({ ok: true, code: ok });
    const bad = (s: string) => validateGameCode(ok.replace('var x = 0;', s));
    for (const s of ["fetch('/x');", 'new XMLHttpRequest();', "new WebSocket('x');", "import('x');", "eval('1');", "Function('return 1')();", 'localStorage.x = 1;', 'parent.x = 1;', 'window.top.location = 1;', "document.cookie = '';", 'navigator.sendBeacon(1);', "var s = 'https://e.com';", 'while (true) {}', 'for (;;) {}', 'document.body.innerHTML = 1;', "var i = new Image(); i.src = 'a';", '</script><script>', 'requestAnimationFrame(f);'])
      expect(bad(s).ok, s).toBe(false);
    expect(validateGameCode('alert(1)').ok).toBe(false);
    expect(validateGameCode(ok + '/*' + 'x'.repeat(20_000) + '*/').ok).toBe(false);
    expect(validateGameCode(42).ok).toBe(false);
  });
  it('the canned demo game passes the check, parses, and follows the spell', () => {
    const t = spellOfAnswers('game', [{ group: 'genre', said: '集める' }, { group: 'hero', said: '猫' }]);
    const g = demoGame(t);
    expect(validateGameCode(g.code).ok).toBe(true);
    expect(() => new Function(`return (${g.code})`)).not.toThrow();
    const harder = demoGame(spellEdit('game', spellEdit('game', t, '敵を増やして').tags, 'もっと難しく').tags);
    expect(harder.code).not.toBe(g.code);
    expect(validateGameCode(harder.code).ok).toBe(true);
    expect(validateGameCode(demoGame(spellOfAnswers('game', [{ group: 'genre', said: 'よける' }])).code).ok).toBe(true);
  });
  it('the sandbox page: a strict CSP (nothing from the network), the fixed harness, the code inside', () => {
    const t = spellOfAnswers('game', [{ group: 'genre', said: '集める' }]);
    const g = demoGame(t);
    const doc = gameDocument({ ...g, tags: t });
    expect(doc).toContain(`content="${GAME_CSP}"`);
    expect(GAME_CSP).toMatch(/default-src 'none'/);
    expect(GAME_CSP).toMatch(/connect-src 'none'/);
    expect(GAME_CSP).not.toMatch(/unsafe-eval/);
    expect(doc).toContain(g.code);
    expect(doc).not.toMatch(/https?:\/\//);
    // a $ in the code is put in as it is (no replacement patterns)
    expect(gameDocument({ code: "function game(G) { var s = '$&$1'; return {}; }", title: 't', howTo: '', tags: t })).toContain("'$&$1'");
    // the title is escaped
    expect(gameDocument({ ...g, title: '<b>', tags: t })).toContain('<title>&lt;b&gt;</title>');
  });
  it('the game writer gets the skeleton rules, and the previous code for a tweak', () => {
    expect(gameSystem()).toContain('function game(G)');
    expect(gameSystem()).toMatch(/Forbidden/);
    const u = gameUser({ tags: spellFrom('game', 'よける'), prev: { code: 'function game(G){}', tags: [] }, said: 'もっと難しく' });
    expect(u).toContain('Previous code:');
    expect(u).toContain('もっと難しく');
  });
});

describe("{bati}'s book and game lines", () => {
  it('every line has all its styles, with the same placeholders and sentences', () => {
    const holes = (t: string) => [...t.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).sort();
    const sentences = (t: string) => (t.match(/[^！？。!?]+[！？。!?]*/g) ?? [t]).length;
    for (const line of CRAFT_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(sentences(s), `${k}: ${s}`).toBe(sentences(line));
      }
    }
  });
});

describe('each Moon-made kind has one home planet', () => {
  it('kororin → Saturn … book → Pluto, game → Neptune; only the planets with a screen can be flown to today', () => {
    expect(KIND_HOME_PLANET).toEqual({ voice: 'saturn', art: 'jupiter', song: 'mercury', video: 'mars', radio: 'venus', goods: 'uranus', novel: 'pluto', book: 'pluto', game: 'neptune' });
    expect(homePlanetOf('game')).toBe('neptune');
    expect(homePlanetOf('look')).toBeNull();
    expect(canFlyHome('song')).toBe(true);
    expect(canFlyHome('novel')).toBe(false);
    expect(HOME_OF_WORK).toEqual({ voice: 'saturn', art: 'jupiter', song: 'mercury', video: 'mars', radio: 'venus' });
  });
});
