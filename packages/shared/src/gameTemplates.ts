import type { GameMakeKind } from './manaPrice';
import type { SpellTag } from './spell';

/**
 * R17 (client 2026-11-25: games cheaper). A member's FIRST game is a cheap trial: {bati} offers
 * 「まずは、かんたんなゲームから作ってみよう！」 and names our prepared games in one sentence (no buttons); the member
 * answers in words. The spell then only customises the template — a Flash-class model fills in its values (title, how to
 * play, speed, amount, goal, time, lives; a quiz's questions) as a small JSON, and the code is ours (always valid; the
 * harness and the sandbox stay the same). From the second game on, the member's own request is written by the cheap
 * chain, or the full one when the request needs it (gameNeedsFull), quoted before the yes; a tweak is cheap first and
 * goes to the full chain only after the cheap one failed the checks twice (quoted again).
 */
export const GAME_TEMPLATE_IDS = ['catch', 'dodge', 'runner', 'shooter', 'match', 'quiz', 'rhythm', 'maze'] as const;
export type GameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];
export const isGameTemplateId = (k: unknown): k is GameTemplateId => typeof k === 'string' && (GAME_TEMPLATE_IDS as readonly string[]).includes(k);

export interface GameTemplate {
  id: GameTemplateId;
  /** how {bati} names it in the sentence */
  ja: string;
  /** what the filler model is told it is */
  en: string;
  /** the member's words that pick it */
  re: RegExp;
}

export const GAME_TEMPLATES: GameTemplate[] = [
  { id: 'catch', ja: '落ちてくる星をキャッチする', en: 'catch the good things falling from above, avoid the red ones', re: /キャッチ|集め|あつめ|拾|ひろ|取る|とる|受け/ },
  { id: 'dodge', ja: '落ちてくるものをよける', en: 'dodge the things falling from above for as long as you can', re: /よけ|避け|かわ|逃げ|にげ/ },
  { id: 'runner', ja: '走ってジャンプする', en: 'an endless runner: jump over the obstacles that come', re: /走|はし|ラン|ジャンプ|とび|跳/ },
  { id: 'shooter', ja: 'うってたおす', en: 'a shooter: move left and right, the shots go up and hit the enemies coming down', re: /うつ|撃|シュー|弾|たま|ビーム|宇宙船/ },
  { id: 'match', ja: '同じ色をそろえて消すパズル', en: 'a puzzle: tap a group of two or more same-coloured tiles to clear them', re: /そろえ|揃え|パズル|消す|けす|色/ },
  { id: 'quiz', ja: 'クイズ', en: 'a quiz with three answers to choose from', re: /クイズ|問題|もんだい|なぞなぞ/ },
  { id: 'rhythm', ja: 'リズムに合わせてタップする', en: 'a rhythm game: tap the lane when the note reaches the line', re: /リズム|音楽|おんがく|タップ|ダンス|音ゲー/ },
  { id: 'maze', ja: '迷路', en: 'a maze: find the way to the goal before the time runs out', re: /迷路|めいろ|迷宮|ゴール/ },
];

/** the member's answer → a template (its words, or 「3番目」), null when it names none */
export function matchGameTemplate(text: string): GameTemplateId | null {
  const t = text.normalize('NFKC');
  const nth = t.match(/([1-8一二三四五六七八])\s*(番|つ目|こ目|個目)/);
  if (nth) {
    const k = '12345678'.indexOf(nth[1]) >= 0 ? '12345678'.indexOf(nth[1]) : '一二三四五六七八'.indexOf(nth[1]);
    if (k >= 0) return GAME_TEMPLATES[k].id;
  }
  // the most specific first: a 「クイズ」 or 「迷路」 is never a catch game
  for (const id of ['quiz', 'maze', 'rhythm', 'match', 'shooter', 'runner', 'dodge', 'catch'] as const) if (GAME_TEMPLATES.find((g) => g.id === id)!.re.test(t)) return id;
  if (/おまかせ|なんでも|何でも|どれでも|まかせ/.test(t)) return 'catch';
  return null;
}

/** the sentence {bati} names them in (no buttons: 「…とか、…とか。どれにする？」) */
export function gameTemplateList(): string {
  return `${GAME_TEMPLATES.map((g) => `${g.ja}のとか`).join('、')}。どれにする？`;
}

// --- the values the filler model gives (clamped: the code is ours, the numbers only tune it) -------------------------

export interface GameQuizItem {
  q: string;
  a: [string, string, string];
  /** the right answer (0..2) */
  ok: number;
}
export interface GameTemplateParams {
  title: string;
  howTo: string;
  /** 0.6 (slow) … 1.8 (fast) */
  speed: number;
  /** how many things / enemies: 0.5 … 2 */
  amount: number;
  /** the score that wins (0: none, play until the end) */
  goal: number;
  /** a time limit in seconds (0: none) */
  seconds: number;
  lives: number;
  /** the quiz only: 3–8 questions */
  quiz?: GameQuizItem[];
}

const num = (v: unknown, a: number, b: number, d: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d;
};
/** words that go into the code: no quotes, slashes, angle brackets or line breaks (and never a URL-looking colon) */
const words = (v: unknown, max: number) =>
  String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u2028\u2029`"'\\<>{}$]/g, '')
    .replace(/:/g, '：')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/=/g, '＝')
    .trim()
    .slice(0, max);

/** what each template starts from (a model that answers nothing still gives a playable game) */
export const GAME_TEMPLATE_DEFAULTS: Record<GameTemplateId, Omit<GameTemplateParams, 'title' | 'howTo'> & { title: string; howTo: string }> = {
  catch: { title: 'ほしキャッチ', howTo: '左右に動いて、星を集めよう。赤い玉はよけてね', speed: 1, amount: 1, goal: 30, seconds: 0, lives: 3 },
  dodge: { title: 'よけろ！', howTo: '左右に動いて、落ちてくるものをよけよう', speed: 1, amount: 1, goal: 0, seconds: 60, lives: 1 },
  runner: { title: 'ジャンプラン', howTo: 'タップかスペースでジャンプ。ぶつからないで走ろう', speed: 1, amount: 1, goal: 30, seconds: 0, lives: 3 },
  shooter: { title: 'スターシューター', howTo: '左右に動くと、自動でうつよ。敵をたおそう', speed: 1, amount: 1, goal: 40, seconds: 0, lives: 3 },
  match: { title: 'いろそろえ', howTo: '同じ色が2つ以上つながったところをタップ', speed: 1, amount: 1, goal: 300, seconds: 90, lives: 1 },
  quiz: {
    title: 'ほしのクイズ',
    howTo: '3つの中から、正しい答えをタップしよう',
    speed: 1,
    amount: 1,
    goal: 0,
    seconds: 0,
    lives: 3,
    quiz: [
      { q: '月はなにのまわりを回る？', a: ['地球', '火星', '太陽だけ'], ok: 0 },
      { q: '虹の色はいくつ？', a: ['3つ', '7つ', '12こ'], ok: 1 },
      { q: 'いちばん大きい惑星は？', a: ['土星', '水星', '木星'], ok: 2 },
      { q: '1年は何日？', a: ['365日', '100日', '30日'], ok: 0 },
      { q: '水がこおると、なにになる？', a: ['湯気', '氷', '砂'], ok: 1 },
    ],
  },
  rhythm: { title: 'リズムタップ', howTo: 'ノートが線に来たら、そのレーンをタップ', speed: 1, amount: 1, goal: 0, seconds: 45, lives: 3 },
  maze: { title: 'ほしの迷路', howTo: '矢印か、行きたい方をおして、ゴールの星へ', speed: 1, amount: 1, goal: 0, seconds: 60, lives: 1 },
};

/** the filler model's answer made safe: the template's defaults where a value is missing or odd */
export function gameTemplateParams(id: GameTemplateId, raw: Record<string, unknown> | null | undefined): GameTemplateParams {
  const d = GAME_TEMPLATE_DEFAULTS[id];
  const r = raw ?? {};
  const quiz =
    id === 'quiz'
      ? (Array.isArray(r.quiz) ? r.quiz : [])
          .map((x): GameQuizItem | null => {
            const o = (x ?? {}) as { q?: unknown; a?: unknown; ok?: unknown };
            const a = Array.isArray(o.a) ? o.a.slice(0, 3).map((s) => words(s, 12)) : [];
            const q = words(o.q, 30);
            return q && a.length === 3 && a.every(Boolean) ? { q, a: a as [string, string, string], ok: Math.round(num(o.ok, 0, 2, 0)) } : null;
          })
          .filter((x): x is GameQuizItem => !!x)
          .slice(0, 8)
      : undefined;
  return {
    title: words(r.title, 12) || d.title,
    howTo: words(r.howTo, 40) || d.howTo,
    speed: num(r.speed, 0.6, 1.8, d.speed),
    amount: num(r.amount, 0.5, 2, d.amount),
    goal: Math.round(num(r.goal, 0, id === 'match' ? 2000 : 99, d.goal)),
    seconds: Math.round(num(r.seconds, 0, 120, d.seconds)),
    lives: Math.round(num(r.lives, 1, 5, d.lives)),
    ...(id === 'quiz' ? { quiz: quiz && quiz.length >= 3 ? quiz : d.quiz } : {}),
  };
}

/** the filler model's rules (it answers only the values; the code is ours) */
export function gameTemplateSystem(id: GameTemplateId): string {
  const g = GAME_TEMPLATES.find((x) => x.id === id)!;
  return [
    `You tune a small ready-made phone game for Japanese teenagers (15+): ${g.en}. The code is fixed; you only choose its values from the spell.`,
    'The colours and the player character come from the spell already. Nothing violent beyond cartoon bumps, nothing scary or grown-up, no real people or existing game characters.',
    'Answer ONLY JSON: {"title": a short Japanese title (12 characters max), "howTo": one short Japanese line on how to play (40 characters max), "speed": 0.6–1.8 (1 = normal), "amount": 0.5–2 (how many things / enemies; 1 = normal), "goal": the score that wins (0 = none), "seconds": a time limit (0 = none, else 30–90), "lives": 1–5' +
      (id === 'quiz' ? ', "quiz": 5 to 8 items {"q": a short Japanese question (30 characters max), "a": [three short Japanese answers (12 characters max)], "ok": the index 0–2 of the right one} about the spell\'s theme, true and kind' : '') +
      '}.',
  ].join('\n');
}

export function gameTemplateUser(o: { tags: SpellTag[]; said?: string }): string {
  return [`The spell: ${o.tags.map((t) => `${t.ja} = ${t.en}`).join('; ') || 'おまかせ'}`, o.said ? `The player said: ${o.said}` : ''].filter(Boolean).join('\n');
}

const lit = (s: string) => JSON.stringify(s);
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * The template's code with its values: one `function game(G)` for the fixed harness (gameDocument), valid against
 * validateGameCode. The level tag (G.level), the colours (G.color) and the hero (G.hero) come from the spell as before.
 */
export function gameTemplateCode(id: GameTemplateId, p: GameTemplateParams): string {
  const head = `var SPEED = ${f2(p.speed)}, AMOUNT = ${f2(p.amount)}, GOAL = ${p.goal}, LIMIT = ${p.seconds}, LIVES = ${p.lives};`;
  const hud = `for (var k = 0; k < lives; k++) G.circle(20 + k * 22, 24, 7, G.color.bad);
      if (GOAL) G.text(G.score + ' / ' + GOAL, G.W / 2, 24, 16, G.color.accent);
      if (LIMIT) G.text(Math.max(0, Math.ceil(LIMIT - G.time)) + '秒', G.W / 2, 48, 14, G.color.fg);`;
  const ends = `if (GOAL && G.score >= GOAL) G.win('クリア！');
      if (LIMIT && G.time >= LIMIT) G.win('タイムアップ！');`;
  switch (id) {
    case 'catch':
    case 'dodge':
      return `function game(G) {
  ${head} var DODGE = ${id === 'dodge'};
  var p, things, spawn, lives, flash;
  function speed() { return (150 + G.level * 55) * SPEED * (1 + G.time * 0.012); }
  return {
    start: function () { p = { x: G.W / 2, y: G.H - 90, r: Math.max(18, G.W / 22) }; things = []; spawn = 0; lives = LIVES; flash = 0; },
    update: function (dt) {
      p.y = G.H - 90;
      if (G.input.pressed) p.x += G.clamp(G.input.x - p.x, -900 * dt, 900 * dt);
      else p.x += G.input.dir() * (380 + G.level * 40) * dt;
      p.x = G.clamp(p.x, p.r, G.W - p.r);
      spawn -= dt;
      if (spawn <= 0) {
        var bad = Math.random() < (DODGE ? 0.8 : 0.3 + G.level * 0.05);
        things.push({ x: G.rand(20, G.W - 20), y: -20, r: bad ? G.rand(14, 22) : 14, bad: bad, v: speed() * G.rand(0.8, 1.25), a: 0 });
        spawn = Math.max(0.15, 0.85 - G.level * 0.12 - G.time * 0.004) / AMOUNT;
      }
      for (var i = things.length - 1; i >= 0; i--) {
        var t = things[i];
        t.y += t.v * dt; t.a += dt * 3;
        if (G.hit(t, p)) {
          things.splice(i, 1);
          if (t.bad) { lives -= 1; flash = 0.3; if (lives <= 0) G.over('ゲームオーバー'); } else G.addScore(1);
          continue;
        }
        if (t.y > G.H + 30) { things.splice(i, 1); if (DODGE && t.bad) G.addScore(1); }
      }
      if (flash > 0) flash -= dt;
      ${ends}
    },
    draw: function () {
      var c = G.ctx;
      for (var s = 0; s < 40; s++) G.circle((s * 97) % G.W, (s * 53 + G.time * 20 * (1 + s % 3)) % G.H, 1 + (s % 2), 'rgba(255,255,255,0.25)');
      for (var i = 0; i < things.length; i++) {
        var t = things[i];
        if (t.bad) G.circle(t.x, t.y, t.r, G.color.bad);
        else {
          c.save(); c.translate(t.x, t.y); c.rotate(t.a); c.fillStyle = G.color.good; c.beginPath();
          for (var j = 0; j < 10; j++) { var rr = j % 2 ? t.r * 0.45 : t.r; c.lineTo(Math.cos(j * Math.PI / 5) * rr, Math.sin(j * Math.PI / 5) * rr); }
          c.closePath(); c.fill(); c.restore();
        }
      }
      if (flash > 0) G.rect(0, 0, G.W, G.H, 'rgba(255,60,80,0.25)');
      G.hero(p.x, p.y, p.r);
      ${hud}
    }
  };
}`;
    case 'runner':
      return `function game(G) {
  ${head}
  var p, rocks, spawn, lives, hurt, ground;
  return {
    start: function () { ground = G.H - 70; p = { x: Math.max(60, G.W * 0.2), y: ground - 22, r: 22, vy: 0 }; rocks = []; spawn = 1; lives = LIVES; hurt = 0; },
    update: function (dt) {
      ground = G.H - 70;
      var on = p.y >= ground - p.r - 0.5;
      if (on && (G.input.tapped || G.input.up || G.input.action)) p.vy = -620 - G.level * 20;
      p.vy += 1500 * dt; p.y = Math.min(ground - p.r, p.y + p.vy * dt);
      var v = (260 + G.level * 50) * SPEED * (1 + G.time * 0.01);
      spawn -= dt;
      if (spawn <= 0) { var h = G.rand(18, 26 + G.level * 6); rocks.push({ x: G.W + 30, y: ground - h, w: G.rand(22, 36), h: h, passed: false }); spawn = G.rand(0.9, 1.7) / (AMOUNT * (1 + G.level * 0.15)); }
      for (var i = rocks.length - 1; i >= 0; i--) {
        var o = rocks[i];
        o.x -= v * dt;
        if (!o.passed && o.x + o.w < p.x - p.r) { o.passed = true; G.addScore(1); }
        if (hurt <= 0 && p.x + p.r * 0.7 > o.x && p.x - p.r * 0.7 < o.x + o.w && p.y + p.r * 0.7 > o.y) { lives -= 1; hurt = 1; if (lives <= 0) G.over('ゲームオーバー'); }
        if (o.x < -60) rocks.splice(i, 1);
      }
      if (hurt > 0) hurt -= dt;
      ${ends}
    },
    draw: function () {
      G.rect(0, ground, G.W, G.H - ground, G.color.accent);
      for (var s = 0; s < 12; s++) G.circle((s * 140 - G.time * 60) % (G.W + 140) + G.W + 70 - (G.W + 140), ground - 120 - (s % 3) * 40, 2, 'rgba(255,255,255,0.4)');
      for (var i = 0; i < rocks.length; i++) G.rect(rocks[i].x, rocks[i].y, rocks[i].w, rocks[i].h, G.color.bad);
      if (hurt <= 0 || Math.floor(G.time * 10) % 2) G.hero(p.x, p.y, p.r);
      ${hud}
    }
  };
}`;
    case 'shooter':
      return `function game(G) {
  ${head}
  var p, shots, foes, spawn, fire, lives;
  return {
    start: function () { p = { x: G.W / 2, y: G.H - 80, r: 20 }; shots = []; foes = []; spawn = 0.5; fire = 0; lives = LIVES; },
    update: function (dt) {
      p.y = G.H - 80;
      if (G.input.pressed) p.x += G.clamp(G.input.x - p.x, -900 * dt, 900 * dt);
      else p.x += G.input.dir() * 420 * dt;
      p.x = G.clamp(p.x, p.r, G.W - p.r);
      fire -= dt;
      if (fire <= 0) { shots.push({ x: p.x, y: p.y - p.r, r: 5 }); fire = 0.28; }
      spawn -= dt;
      if (spawn <= 0) { foes.push({ x: G.rand(24, G.W - 24), y: -24, r: G.rand(14, 22), v: (70 + G.level * 30) * SPEED * G.rand(0.8, 1.3), w: G.rand(0, 6) }); spawn = Math.max(0.25, 1.2 - G.level * 0.15 - G.time * 0.005) / AMOUNT; }
      for (var i = shots.length - 1; i >= 0; i--) { shots[i].y -= 620 * dt; if (shots[i].y < -10) shots.splice(i, 1); }
      for (var j = foes.length - 1; j >= 0; j--) {
        var f = foes[j];
        f.y += f.v * dt; f.x += Math.sin(G.time * 2 + f.w) * 40 * dt;
        var gone = false;
        for (var k = shots.length - 1; k >= 0; k--) if (G.hit(shots[k], f)) { shots.splice(k, 1); gone = true; G.addScore(1); break; }
        if (!gone && (G.hit(f, p) || f.y > G.H + 20)) { gone = true; lives -= 1; if (lives <= 0) G.over('ゲームオーバー'); }
        if (gone) foes.splice(j, 1);
      }
      ${ends}
    },
    draw: function () {
      for (var s = 0; s < 50; s++) G.circle((s * 71) % G.W, (s * 37 + G.time * 60 * (1 + s % 3)) % G.H, 1, 'rgba(255,255,255,0.35)');
      for (var i = 0; i < shots.length; i++) G.circle(shots[i].x, shots[i].y, shots[i].r, G.color.good);
      for (var j = 0; j < foes.length; j++) { G.circle(foes[j].x, foes[j].y, foes[j].r, G.color.bad); G.circle(foes[j].x, foes[j].y, foes[j].r * 0.4, G.color.bg); }
      G.hero(p.x, p.y, p.r);
      ${hud}
    }
  };
}`;
    case 'match':
      return `function game(G) {
  ${head}
  var COLS = 6, ROWS = 8, KINDS = Math.min(5, 3 + G.level - 1 + (AMOUNT > 1.4 ? 1 : 0)), grid, cell, ox, oy, cur, lives;
  function colorOf(n) { return [G.color.accent, G.color.good, G.color.bad, G.color.fg, '#8fd3ff'][n]; }
  function fill() { grid = []; for (var x = 0; x < COLS; x++) { grid.push([]); for (var y = 0; y < ROWS; y++) grid[x].push(Math.floor(Math.random() * KINDS)); } }
  function layout() { cell = Math.floor(Math.min((G.W - 20) / COLS, (G.H - 120) / ROWS)); ox = (G.W - cell * COLS) / 2; oy = 80; }
  function group(x, y) {
    var want = grid[x][y], seen = {}, list = [], stack = [[x, y]];
    while (stack.length) {
      var c = stack.pop(), cx = c[0], cy = c[1], key = cx + ',' + cy;
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS || seen[key] || grid[cx][cy] !== want || want < 0) continue;
      seen[key] = 1; list.push(c);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return list;
  }
  function fall() { for (var x = 0; x < COLS; x++) { var col = grid[x].filter(function (v) { return v >= 0; }); while (col.length < ROWS) col.unshift(Math.floor(Math.random() * KINDS)); grid[x] = col; } }
  function take(x, y) { var g = group(x, y); if (g.length < 2) return; for (var i = 0; i < g.length; i++) grid[g[i][0]][g[i][1]] = -1; G.addScore(g.length * g.length); fall(); }
  return {
    start: function () { fill(); layout(); cur = { x: 0, y: 0, t: 0 }; lives = LIVES; },
    update: function (dt) {
      layout();
      cur.t -= dt;
      if (cur.t <= 0) {
        if (G.input.left) { cur.x = Math.max(0, cur.x - 1); cur.t = 0.15; }
        if (G.input.right) { cur.x = Math.min(COLS - 1, cur.x + 1); cur.t = 0.15; }
        if (G.input.up) { cur.y = Math.max(0, cur.y - 1); cur.t = 0.15; }
        if (G.input.down) { cur.y = Math.min(ROWS - 1, cur.y + 1); cur.t = 0.15; }
      }
      if (G.input.tapped) {
        var tx = Math.floor((G.input.x - ox) / cell), ty = Math.floor((G.input.y - oy) / cell);
        if (G.input.pressed && tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS) { cur.x = tx; cur.y = ty; }
        take(cur.x, cur.y);
      }
      ${ends}
    },
    draw: function () {
      for (var x = 0; x < COLS; x++) for (var y = 0; y < ROWS; y++) G.circle(ox + x * cell + cell / 2, oy + y * cell + cell / 2, cell * 0.42, colorOf(grid[x][y]));
      G.ctx.strokeStyle = G.color.fg; G.ctx.lineWidth = 3; G.ctx.strokeRect(ox + cur.x * cell + 2, oy + cur.y * cell + 2, cell - 4, cell - 4);
      G.text(G.score + (GOAL ? ' / ' + GOAL : ''), G.W / 2, 24, 18, G.color.accent);
      if (LIMIT) G.text(Math.max(0, Math.ceil(LIMIT - G.time)) + '秒', G.W / 2, 50, 14, G.color.fg);
    }
  };
}`;
    case 'quiz': {
      const qs = (p.quiz ?? GAME_TEMPLATE_DEFAULTS.quiz.quiz!).map((x) => `{ q: ${lit(x.q)}, a: [${x.a.map(lit).join(', ')}], ok: ${x.ok} }`).join(',\n    ');
      return `function game(G) {
  ${head}
  var QS = [
    ${qs}
  ];
  var n, pick, wait, lives, right, box;
  function boxes() { var w = Math.min(G.W - 40, 420), h = 56, x = (G.W - w) / 2, y = G.H * 0.45; return [0, 1, 2].map(function (i) { return { x: x, y: y + i * (h + 14), w: w, h: h }; }); }
  function answer(i) { if (wait > 0) return; var ok = i === QS[n].ok; right = ok; wait = 1.1; if (ok) G.addScore(1); else { lives -= 1; } }
  return {
    start: function () { n = 0; pick = 0; wait = 0; lives = LIVES; right = null; },
    update: function (dt) {
      box = boxes();
      if (wait > 0) {
        wait -= dt;
        if (wait <= 0) {
          right = null; n += 1; pick = 0;
          if (lives <= 0) G.over('ざんねん！');
          else if (n >= QS.length) { if (G.score >= Math.ceil(QS.length * 0.6)) G.win('クリア！'); else G.over(G.score + '問正解'); }
        }
        return;
      }
      if (G.input.tapped && G.input.pressed) { for (var i = 0; i < 3; i++) { var b = box[i]; if (G.input.x > b.x && G.input.x < b.x + b.w && G.input.y > b.y && G.input.y < b.y + b.h) answer(i); } }
      else if (G.input.tapped) answer(pick);
      if (G.input.up) pick = 0; if (G.input.left) pick = Math.max(0, pick - 1); if (G.input.right || G.input.down) pick = Math.min(2, pick + 1);
      if (LIMIT && G.time >= LIMIT) G.over('タイムアップ！');
    },
    draw: function () {
      if (n >= QS.length) return;
      var Q = QS[Math.min(n, QS.length - 1)];
      G.text((n + 1) + ' / ' + QS.length, G.W / 2, 30, 14, G.color.fg);
      G.text(Q.q, G.W / 2, G.H * 0.28, Math.max(16, Math.min(24, G.W / 18)), G.color.fg);
      for (var i = 0; i < 3; i++) {
        var b = box[i], col = G.color.accent;
        if (wait > 0 && i === Q.ok) col = G.color.good; else if (wait > 0) col = 'rgba(255,255,255,0.15)';
        G.rect(b.x, b.y, b.w, b.h, col);
        if (i === pick && wait <= 0) { G.ctx.strokeStyle = G.color.fg; G.ctx.lineWidth = 3; G.ctx.strokeRect(b.x, b.y, b.w, b.h); }
        G.text(Q.a[i], b.x + b.w / 2, b.y + b.h / 2, 18, G.color.bg);
      }
      if (right !== null) G.text(right ? 'せいかい！' : 'ちがうよ', G.W / 2, G.H * 0.38, 20, right ? G.color.good : G.color.bad);
      for (var k = 0; k < lives; k++) G.circle(20 + k * 22, 24, 7, G.color.bad);
    }
  };
}`;
    }
    case 'rhythm':
      return `function game(G) {
  ${head}
  var notes, beat, lives, combo, flash, line, BPM = Math.round(90 + 20 * G.level * SPEED);
  function laneX(i) { return G.W * (i + 1) / 4; }
  function hitLane(i) {
    for (var k = 0; k < notes.length; k++) { var n = notes[k]; if (n.lane === i && Math.abs(n.y - line) < 46) { notes.splice(k, 1); combo += 1; G.addScore(1 + Math.floor(combo / 10)); flash[i] = 0.15; return; } }
    combo = 0;
  }
  return {
    start: function () { notes = []; beat = 0; lives = LIVES * 3; combo = 0; flash = [0, 0, 0]; },
    update: function (dt) {
      line = G.H - 110;
      beat -= dt;
      if (beat <= 0) { notes.push({ lane: Math.floor(Math.random() * 3), y: -20 }); if (Math.random() < 0.2 * AMOUNT) notes.push({ lane: Math.floor(Math.random() * 3), y: -80 }); beat = 60 / BPM; }
      var v = (line + 20) / (2.2 / SPEED);
      for (var k = notes.length - 1; k >= 0; k--) { notes[k].y += v * dt; if (notes[k].y > line + 60) { notes.splice(k, 1); combo = 0; lives -= 1; if (lives <= 0) G.over('ゲームオーバー'); } }
      if (G.input.tapped && G.input.pressed) hitLane(G.clamp(Math.floor(G.input.x / (G.W / 3)), 0, 2));
      else if (G.input.tapped) hitLane(1);
      for (var i = 0; i < 3; i++) if (flash[i] > 0) flash[i] -= dt;
      ${ends}
    },
    draw: function () {
      for (var i = 0; i < 3; i++) { G.rect(laneX(i) - 2, 0, 4, G.H, 'rgba(255,255,255,0.12)'); G.circle(laneX(i), line, 30, flash[i] > 0 ? G.color.good : 'rgba(255,255,255,0.2)'); }
      for (var k = 0; k < notes.length; k++) G.circle(laneX(notes[k].lane), notes[k].y, 22, G.color.accent);
      G.hero(G.W / 2, G.H - 40, 18);
      if (combo > 2) G.text(combo + ' コンボ', G.W / 2, line - 70, 18, G.color.good);
      G.text(G.score + (GOAL ? ' / ' + GOAL : ''), G.W / 2, 24, 16, G.color.accent);
      if (LIMIT) G.text(Math.max(0, Math.ceil(LIMIT - G.time)) + '秒', G.W / 2, 48, 14, G.color.fg);
    }
  };
}`;
    case 'maze':
      return `function game(G) {
  ${head}
  var N = Math.min(15, 5 + G.level * 2 + Math.round((AMOUNT - 1) * 2)), wall, p, cell, ox, oy, step;
  function build() {
    wall = []; var seen = [], x, y;
    for (x = 0; x < N; x++) { wall.push([]); seen.push([]); for (y = 0; y < N; y++) { wall[x].push([1, 1, 1, 1]); seen[x].push(false); } }
    var stack = [[0, 0]]; seen[0][0] = true;
    var D = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    while (stack.length) {
      var c = stack[stack.length - 1], open = [];
      for (var d = 0; d < 4; d++) { var nx = c[0] + D[d][0], ny = c[1] + D[d][1]; if (nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[nx][ny]) open.push(d); }
      if (!open.length) { stack.pop(); continue; }
      var k = open[Math.floor(Math.random() * open.length)], tx = c[0] + D[k][0], ty = c[1] + D[k][1];
      wall[c[0]][c[1]][D[k][2]] = 0; wall[tx][ty][D[k][3]] = 0; seen[tx][ty] = true; stack.push([tx, ty]);
    }
  }
  function layout() { cell = Math.floor(Math.min((G.W - 20) / N, (G.H - 100) / N)); ox = (G.W - cell * N) / 2; oy = 70; }
  function go(d) { var dx = [0, 1, 0, -1][d], dy = [-1, 0, 1, 0][d]; if (!wall[p.x][p.y][d]) { p.x += dx; p.y += dy; } }
  return {
    start: function () { build(); layout(); p = { x: 0, y: 0 }; step = 0; },
    update: function (dt) {
      layout();
      step -= dt;
      if (step <= 0) {
        var d = -1;
        if (G.input.up) d = 0; else if (G.input.right) d = 1; else if (G.input.down) d = 2; else if (G.input.left) d = 3;
        else if (G.input.pressed) { var cx = ox + p.x * cell + cell / 2, cy = oy + p.y * cell + cell / 2, ddx = G.input.x - cx, ddy = G.input.y - cy; if (Math.abs(ddx) > cell / 2 || Math.abs(ddy) > cell / 2) d = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 1 : 3) : (ddy > 0 ? 2 : 0); }
        if (d >= 0) { go(d); step = 0.14 / SPEED; }
      }
      if (p.x === N - 1 && p.y === N - 1) { G.addScore(Math.max(1, Math.round((LIMIT || 90) - G.time))); G.win('ゴール！'); }
      if (LIMIT && G.time >= LIMIT) G.over('タイムアップ！');
    },
    draw: function () {
      var c = G.ctx; c.strokeStyle = G.color.fg; c.lineWidth = 2; c.beginPath();
      for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) {
        var X = ox + x * cell, Y = oy + y * cell, w = wall[x][y];
        if (w[0]) { c.moveTo(X, Y); c.lineTo(X + cell, Y); }
        if (w[1]) { c.moveTo(X + cell, Y); c.lineTo(X + cell, Y + cell); }
        if (w[2]) { c.moveTo(X, Y + cell); c.lineTo(X + cell, Y + cell); }
        if (w[3]) { c.moveTo(X, Y); c.lineTo(X, Y + cell); }
      }
      c.stroke();
      G.circle(ox + (N - 0.5) * cell, oy + (N - 0.5) * cell, cell * 0.3, G.color.good);
      G.hero(ox + (p.x + 0.5) * cell, oy + (p.y + 0.5) * cell, cell * 0.36);
      if (LIMIT) G.text(Math.max(0, Math.ceil(LIMIT - G.time)) + '秒', G.W / 2, 30, 16, G.color.fg);
    }
  };
}`;
  }
}

/** the trial game, whole: the values made safe, the template's code, its title and how to play */
export function gameFromTemplate(id: GameTemplateId, raw: Record<string, unknown> | null | undefined, valid: (code: string) => boolean = () => true): { title: string; howTo: string; code: string } {
  const p = gameTemplateParams(id, raw);
  const code = gameTemplateCode(id, p);
  // the model's words still tripped a rule (an English word like "location" in a quiz; `valid` = validateGameCode): the
  // template's own words
  if (!valid(code)) return { title: p.title, howTo: p.howTo, code: gameTemplateCode(id, { ...p, quiz: GAME_TEMPLATE_DEFAULTS[id].quiz }) };
  return { title: p.title, howTo: p.howTo, code };
}

// --- which game making a request is (the quote before the yes) -------------------------------------------------------

/** what makes a request big enough for the full chain: these, or a long request with many rules */
const BIG = [
  /ボス|ステージ|面クリア|ワールド|レベルアップ|経験値|育て|進化/,
  /アイテム|ショップ|お店|武器|装備|スキル|魔法を(選|えら)|インベントリ|持ち物/,
  /物理|重力|ばね|バネ|振り子|ロープ/,
  /2人|二人|ふたり|対戦|協力|オンライン|ランキング/,
  /ストーリー|会話|セリフ|イベント|エンディング|分岐/,
  /セーブ|つづきから|続きから/,
  /3D|立体|奥行き/,
  /RPG|ロールプレイング|シミュレーション|カード|デッキ|将棋|チェス|オセロ|テトリス|落ち物/,
  /マップ|スクロール|横スクロール|ダンジョン/,
  /敵の種類|何種類|いろんな敵|複数の敵|ボタンを(いくつも|たくさん)/,
];

/**
 * A request's size (0…): the big features it names, plus its length and the number of talismans. ≥ 2 → the full chain.
 * A small heuristic on purpose: it only picks the model the quote is for (the member hears the price before the yes).
 */
export function gameComplexity(said: string, tags: SpellTag[] = []): number {
  const t = `${said} ${tags.map((x) => x.ja).join(' ')}`.normalize('NFKC');
  const big = BIG.filter((re) => re.test(t)).length;
  const length = Math.floor([...said.trim()].length / 80);
  const rules = Math.max(0, tags.filter((x) => x.group === 'rule' || x.group === 'event' || x.group === 'goal').length - 2) * 0.5;
  return big + length + rules;
}
export const gameNeedsFull = (said: string, tags: SpellTag[] = []) => gameComplexity(said, tags) >= 2;

/** which model chain a game making is written by */
export type GameTier = 'trial' | 'cheap' | 'full';
export const GAME_TIERS = ['trial', 'cheap', 'full'] as const;

/** the making of a tier: a new game (trial / cheap / full) or a tweak of one (cheap / full) */
export function gameMakeKind(recast: boolean, tier: GameTier): GameMakeKind {
  if (recast) return tier === 'full' ? 'gameTweakPro' : 'gameTweak';
  return tier === 'trial' ? 'gameTrial' : tier === 'full' ? 'gamePro' : 'game';
}
export function gameTierOf(kind: GameMakeKind): GameTier {
  return kind === 'gameTrial' ? 'trial' : kind === 'gamePro' || kind === 'gameTweakPro' ? 'full' : 'cheap';
}

/**
 * The tier a game request is quoted at: the first game from a template → the trial; a tweak → cheap, or full after the
 * cheap chain failed the checks twice (`escalate`); a new game → full when the request needs it, else cheap.
 */
export function gameTierFor(o: { recast: boolean; firstGame?: boolean; template?: GameTemplateId | null; said?: string; tags?: SpellTag[]; escalate?: boolean }): GameTier {
  if (o.recast) return o.escalate ? 'full' : 'cheap';
  if (o.firstGame && o.template) return 'trial';
  return gameNeedsFull(o.said ?? '', o.tags ?? []) ? 'full' : 'cheap';
}
