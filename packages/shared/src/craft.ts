import { z } from 'zod';
import type { BluenaPlanet } from './finds';
import { MakeConfirm } from './makeConfirm';
import { spellPrompt, SpellTags, type SpellGroup, type SpellTag } from './spell';

/**
 * Client 2026-11-25 — 本 (novel) and ゲーム (game) on the Moon: 「会話で始めて、スペルで決めて、会話で直す」.
 *  1. {bati} asks 2–4 short questions (no choice buttons; the examples are inside the sentences).
 *  2. It distils the answers into a spell (≤ 8 talismans, its own defaults for what was not said: spellOfAnswers) and asks
 *     「このスペルで作る？　それとも、どこか変える？」 — a yes casts, other words change the tags.
 *  3. Once it is made, the member says what to change (「もっと暗く」「主人公を猫に」「もっと難しく」) → the tags change → a recast.
 *  4. Big works go in stages: a book is first a spell for its world / hero / tone, then chapter by chapter (each chapter a
 *     small spell of its own, a talk between); a game is first a spell for its genre / rules / goal / look, then played,
 *     then tweaked.
 *  5. A book is free (no confirm card, its chapters are capped a day: NOVEL_CHAPTERS_PER_DAY); a game spends mana with the
 *     yes (MAKE_COST.game, then MAKE_COST.gameTweak per tweak; mana back when it could not be made or does not run).
 */
export const CRAFT_KINDS = ['novel', 'game'] as const;
export type CraftKind = (typeof CRAFT_KINDS)[number];
export const isCraftKind = (k: string): k is CraftKind => (CRAFT_KINDS as readonly string[]).includes(k);

// --- 1. the questions ---------------------------------------------------------------------------------------------

/** one of {bati}'s questions: its words (the examples inside) and the group its answer's free words go into */
export type CraftQuestion = { group: SpellGroup; text: string; /** the groups that, already named, make it needless */ covers: SpellGroup[] };

export const CRAFT_QUESTIONS: Record<CraftKind, CraftQuestion[]> = {
  novel: [
    { group: 'world', covers: ['world'], text: 'いいね、本を作ろう！　どんな世界のお話にする？　たとえば、魔法の森とか、未来の街とか。' },
    { group: 'hero', covers: ['hero'], text: '主人公は、だれにする？　メガネの男の子とか、しゃべる猫とか。' },
    { group: 'mood', covers: ['mood', 'genre'], text: 'どんな気分のお話がいい？　わくわくする冒険とか、ちょっと切ないのとか。' },
  ],
  game: [
    { group: 'genre', covers: ['genre'], text: 'いいね、ゲームを作ろう！　どんなゲームにする？　落ちてくる星を集めるのとか、よけるのとか、クイズとか。' },
    { group: 'hero', covers: ['hero', 'goal'], text: '主人公はだれ？　それと、どうなったら勝ち？　30こ集めたら勝ち、とか。' },
    { group: 'color', covers: ['color', 'style'], text: '見た目は、どんな感じ？　夜空っぽくとか、ネオンでピカピカとか。' },
  ],
};

/**
 * The questions to ask for a start that already said some of it (「猫が主人公のゲーム」 needs no hero question): those
 * whose groups the words did not name — but always at least two (the client: 2–4 short questions).
 */
export function questionsFor(kind: CraftKind, namedGroups: readonly SpellGroup[]): CraftQuestion[] {
  const all = CRAFT_QUESTIONS[kind];
  const left = all.filter((q) => !q.covers.some((g) => namedGroups.includes(g)));
  if (left.length >= 2) return left;
  return [...left, ...all.filter((q) => !left.includes(q))].slice(0, 2).sort((a, b) => all.indexOf(a) - all.indexOf(b));
}

// --- {bati}'s lines -----------------------------------------------------------------------------------------------

/**
 * {bati}'s lines for books and games, as written (元気な子; the other styles in CRAFT_VARIANTS, which BATI_VARIANTS
 * includes). {n} = a chapter number / minutes, {title} = the work's name, {mana} = the mana given back.
 */
export const CRAFT_LINES = {
  // 2. the spell itself is asked with MOON_LINES.confirm 「このスペルで作る？　それとも、どこか変える？」
  /** 2. the next chapter's small spell */
  chapterSpell: 'つぎの章は、このスペルでいく？　それとも、どこか変える？',
  /** a book is cast at once (free): {bati} writes */
  write: 'よし、書くね！',
  /** 4. a chapter is written: what happens next? */
  chapterDone: '第{n}章ができたよ。つづきは、どうなる？　たとえば、新しい仲間が来るとか、嵐になるとか。「おまかせ」でもいいよ。',
  /** the first chapter: the book is in Bluena */
  bookKept: '本は、ブルーナにしまったよ。表紙をおすと、読めるよ。',
  /** the last chapter */
  bookEnd: 'おしまい！　いいお話になったね。ブルーナで、いつでも読み返せるよ。',
  /** the day's chapters are used up */
  chapterLimit: '今日は、もうたくさん書いたね。つづきは、また明日にしよう。',
  /** the book has as many chapters as it can hold */
  bookFull: 'この本は、もういっぱい。新しい本を作ろう。',
  /** a game is made (playable on the card) */
  gameDone: 'できたよ！　遊んでみて。「もっと難しく」「敵を増やして」みたいに言えば、直すよ。',
  /** a game could not be made, or does not run: the mana is back */
  gameBroken: 'ごめん、ゲームがうまく動かなかった。マナは返したよ。もう一回、頼んでくれる？',
  /** a chapter / a game that could not be made */
  failed: 'ごめん、うまく作れなかった。もう一回、頼んでくれる？',
} as const;
export const CRAFT_LINE_TEXTS: string[] = [...Object.values(CRAFT_LINES), ...Object.values(CRAFT_QUESTIONS).flatMap((qs) => qs.map((q) => q.text))];

// --- the API's bodies and views -----------------------------------------------------------------------------------

/** POST /moon/novel/chapter: a new book from its spell (no bookId), or the next chapter of the book from a chapter spell */
export const NovelChapterBody = z.object({
  bookId: z.string().uuid().optional(),
  tags: SpellTags,
  /** what the member said for this chapter (the spell is the main thing; this is context) */
  said: z.string().trim().max(200).optional(),
});
export type NovelChapterBody = z.infer<typeof NovelChapterBody>;

export interface ChapterView {
  n: number;
  title: string;
  text: string;
  tags: SpellTag[];
  at: string;
}
export interface BookView {
  id: string;
  title: string;
  /** the book's own spell (world, hero, tone, length …) */
  tags: SpellTag[];
  /** a painted cover, when there is one (none: the typographic cover in the A look, drawn by the app) */
  cover: string | null;
  chapters: ChapterView[];
  /** the last chapter was the final one */
  done: boolean;
  /** its home planet (KIND_HOME_PLANET.novel: Pluto), stored with the book */
  home: BluenaPlanet;
  createdAt: string;
  updatedAt: string;
}

/** POST /moon/game: a new game (no gameId) or a recast of it, always with the yes (its price, its spell) */
export const GameBuildBody = z.object({
  gameId: z.string().uuid().optional(),
  tags: SpellTags,
  said: z.string().trim().max(200).optional(),
  confirm: MakeConfirm,
});
export type GameBuildBody = z.infer<typeof GameBuildBody>;
/** POST /moon/game/:id/broken: the version did not run in the sandbox (the mana given back, a few times a day) */
export const GameBrokenBody = z.object({ version: z.number().int().min(0).max(99), reason: z.string().trim().max(200).default('') });
export type GameBrokenBody = z.infer<typeof GameBrokenBody>;

export interface GameView {
  id: string;
  title: string;
  /** how to play, one short Japanese line */
  howTo: string;
  tags: SpellTag[];
  /** the version on the face (0 = the first build) */
  version: number;
  /** the game logic (validated); the app puts it into the fixed harness (gameDocument) and runs it in a sandbox */
  code: string;
  /** its home planet (KIND_HOME_PLANET.game: Neptune), stored with the game */
  home: BluenaPlanet;
  createdAt: string;
  updatedAt: string;
}

// --- prompt assembly ----------------------------------------------------------------------------------------------

const groupWords = (tags: SpellTag[], g: SpellGroup) => tags.filter((t) => t.group === g).map((t) => t.ja);
/** the chapter length the book's length tag asks for (Japanese characters) */
export function chapterChars(tags: SpellTag[]): { min: number; max: number } {
  const l = tags.find((t) => t.group === 'length')?.ja;
  return l === '短め' ? { min: 1300, max: 1700 } : l === '長め' ? { min: 2200, max: 2600 } : { min: 1700, max: 2200 };
}
export const isFinalChapter = (tags: SpellTag[]) => tags.some((t) => /final chapter/i.test(t.en));

/** the writer's rules (Gemini; the same for every chapter) */
export function novelSystem(): string {
  return [
    'あなたは、15〜20歳の読者のために、日本語で連載小説を書く作家です。',
    '- 読みやすく、あたたかく、少しわくわくする文章。会話文も入れる。ふりがなや注釈は書かない。',
    '- 性的な内容、ひどい暴力や流血、自傷、差別、実在の人物・実在の作品やブランドのキャラクターは書かない。こわい話も、10代が安心して読める程度にする。',
    '- 1回に書くのは1章だけ。章の終わりは、つづきが気になる形にする（最終章なら、きれいに終わらせる）。',
    '- 返事は JSON だけ：{"title": 本の題（12字まで、第1章の時だけ。それ以外は空でよい）, "chapterTitle": 章の題（12字まで）, "text": 本文（段落は改行で区切る）, "summary": この章のあらすじ（60字まで）}',
  ].join('\n');
}

/**
 * one chapter's request: the book's spell (in Japanese words and the English behind them), what happened so far (the
 * chapters' titles and short summaries, the last chapter's end), and this chapter's small spell
 */
export function novelUser(o: { book: SpellTag[]; n: number; before: { title: string; summary: string }[]; lastText?: string; chapter?: SpellTag[]; said?: string }): string {
  const len = chapterChars(o.book);
  const lines = [
    `【本のスペル】${o.book.map((t) => t.ja).join('、')}`,
    `（英語の意味：${spellPrompt('novel', o.book)}）`,
    `世界：${groupWords(o.book, 'world').join('、') || 'おまかせ'}　主人公：${groupWords(o.book, 'hero').join('、') || 'おまかせ'}　気分：${[...groupWords(o.book, 'mood'), ...groupWords(o.book, 'genre')].join('、') || 'おまかせ'}`,
  ];
  if (o.before.length) {
    lines.push('【これまでのお話】');
    for (const [i, c] of o.before.entries()) lines.push(`第${i + 1}章「${c.title}」：${c.summary}`);
    if (o.lastText) lines.push(`（前の章の終わり）……${o.lastText.slice(-300)}`);
  }
  if (o.chapter?.length) {
    lines.push(`【この章のスペル】${o.chapter.map((t) => t.ja).join('、')}`);
    lines.push(`（英語の意味：${spellPrompt('chapter', o.chapter)}）`);
  }
  if (o.said) lines.push(`【読者のひとこと】${o.said}`);
  lines.push(`第${o.n}章を書いて。本文は${len.min}〜${len.max}字。${o.chapter && isFinalChapter(o.chapter) ? 'これが最終章。' : ''}`);
  return lines.join('\n');
}

/** the game writer's rules: only the logic, inside the fixed harness (gameDocument) */
export function gameSystem(): string {
  return [
    'You write the logic of a tiny single-screen HTML5 canvas game for Japanese teenagers (15+). The app has a FIXED harness; you only write one JavaScript function that the harness calls.',
    'Write exactly: function game(G) { ...; return { start: function () {...}, update: function (dt) {...}, draw: function () {...} }; }',
    'The harness gives G:',
    '- G.W, G.H: the canvas size in CSS pixels (it can change on resize: read them every frame). G.ctx: the 2D context, already scaled. The harness clears the screen with G.color.bg before draw and draws the score itself.',
    '- G.input: { left, right, up, down, action } booleans (arrow keys / WASD / space, and on touch: action while a finger is down); { x, y, pressed } the pointer (finger or mouse) position and whether it is pressed; tapped: true for one frame after a tap or click; G.input.dir(): -1, 0 or 1 for left/right.',
    '- G.score (read), G.addScore(n), G.over(text) to end a run (lost), G.win(text) to end a run (won). The harness shows the result and restarts on tap / space by calling start() again (reset all state in start()).',
    '- G.level: 1 easy, 2 normal, 3 hard, 4 very hard (make speed and the number of enemies grow with it). G.time: seconds since this run started. G.rand(a, b), G.clamp(v, a, b), G.hit(a, b) (circle-circle: objects with x, y, r).',
    '- G.color: { bg, fg, accent, good, bad } colours to use. G.circle(x, y, r, color), G.rect(x, y, w, h, color), G.text(str, x, y, size, color, align), G.hero(x, y, r): draws the player character from the spell.',
    'Rules: dt is in seconds, move things by speed * dt. Playable with one finger on a phone AND with a keyboard. A run lasts 30–90 seconds. Japanese text only for short words (G.text). Keep it under 12000 characters.',
    'Forbidden (the code is rejected): fetch, XMLHttpRequest, WebSocket, EventSource, import, require, eval, Function constructor, setTimeout/setInterval with strings, Worker, document.cookie, localStorage, sessionStorage, indexedDB, window.open, location, parent, top, opener, postMessage, innerHTML, document.write, any URL or network access, external images or fonts, while(true), for(;;). Use requestAnimationFrame? No: the harness runs the loop.',
    'Nothing violent beyond cartoon bumps, nothing scary or grown-up, no real people or existing game characters.',
    'Answer ONLY JSON: {"title": a short Japanese title (12 characters max), "howTo": one short Japanese line on how to play (40 characters max), "code": the function as a string}.',
  ].join('\n');
}

export function gameUser(o: { tags: SpellTag[]; prev?: { code: string; tags: SpellTag[] } | null; said?: string }): string {
  const lines = [`The spell (Japanese labels with the meaning): ${o.tags.map((t) => `${t.ja} = ${t.en}`).join('; ')}`, `In short: ${spellPrompt('game', o.tags)}`];
  if (o.prev) {
    lines.push('This is a change of the game below. Keep what works and change only what the spell / the words ask for (the difficulty, the number of enemies, the look, a rule …).');
    if (o.said) lines.push(`The player asked: ${o.said}`);
    lines.push('Previous code:', o.prev.code.slice(0, 12_000));
  } else if (o.said) lines.push(`The player said: ${o.said}`);
  return lines.join('\n');
}

// --- the game: validation and the fixed harness --------------------------------------------------------------------

export const GAME_CODE_MAX = 16_000;
/** what the code must never do (the sandbox is the real guard; this keeps the obvious out and tells the model why) */
const FORBIDDEN: [RegExp, string][] = [
  [/<\/?script|<!--|-->|<\/|<iframe|<link|<img|<style/i, 'html tags'],
  [/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b|\bRTCPeerConnection\b|\bWebTransport\b/, 'network access'],
  [/\bimport\s*\(|^\s*import\s|\bimportScripts\b|\brequire\s*\(/m, 'import'],
  [/\beval\s*\(|\bFunction\s*\(|\bnew\s+Function\b|\bset(Timeout|Interval)\s*\(\s*['"`]/, 'eval'],
  [/\b(Shared)?Worker\s*\(|\bServiceWorker\b|\bnavigator\s*\.\s*serviceWorker\b/, 'workers'],
  [/\bdocument\s*\.\s*(cookie|write|domain)\b|\b(local|session)Storage\b|\bindexedDB\b|\bcaches\b/, 'storage'],
  [/\bwindow\s*\.\s*open\b|\blocation\b|\bparent\b|\btop\s*\.|\bopener\b|\bpostMessage\b|\bframeElement\b/, 'other windows'],
  [/\binnerHTML\b|\bouterHTML\b|\binsertAdjacentHTML\b|\bcreateElement\s*\(\s*['"`](script|iframe|img|link|audio|video|object|embed)/i, 'markup'],
  [/https?:|wss?:|data:|blob:|\burl\s*\(/i, 'urls'],
  [/\.src\s*=|\bnew\s+Image\b|\bnew\s+Audio\b|\bFontFace\b/, 'loading things'],
  [/\bwhile\s*\(\s*(true|1|!0)\s*\)|\bfor\s*\(\s*;\s*;\s*\)|\bdo\s*\{[^}]*\}\s*while\s*\(\s*(true|1)\s*\)/, 'endless loops'],
  [/\brequestAnimationFrame\b/, 'own loop'],
];

export type GameCodeCheck = { ok: true; code: string } | { ok: false; reason: string };
/** the generated logic, checked before it is kept: one `function game(G)`, small, none of the forbidden things */
export function validateGameCode(raw: unknown): GameCodeCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'no code' };
  const code = raw.replace(/^\s*```(?:js|javascript)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  if (!code) return { ok: false, reason: 'no code' };
  if (code.length > GAME_CODE_MAX) return { ok: false, reason: 'too long' };
  if (!/^function\s+game\s*\(\s*G\s*\)\s*\{/.test(code)) return { ok: false, reason: 'not function game(G)' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u2028\u2029]/.test(code)) return { ok: false, reason: 'control characters' };
  for (const [re, why] of FORBIDDEN) if (re.test(code)) return { ok: false, reason: why };
  return { ok: true, code };
}

/** the game's colours from its spell (the look / colour tags) */
export function gamePalette(tags: SpellTag[]): { bg: string; fg: string; accent: string; good: string; bad: string } {
  const c = tags.filter((t) => t.group === 'color' || t.group === 'style').map((t) => t.ja).join(' ');
  if (/ネオン/.test(c)) return { bg: '#0b0820', fg: '#f4f1ff', accent: '#ff4fd8', good: '#39f3ff', bad: '#ff5a5a' };
  if (/夜空/.test(c)) return { bg: '#0d1642', fg: '#eef2ff', accent: '#ffd45a', good: '#ffe680', bad: '#8f7bff' };
  if (/やわらかい|ピンク/.test(c)) return { bg: '#ffeef5', fg: '#4a3550', accent: '#ff8fb8', good: '#7fd6c2', bad: '#a58bd8' };
  if (/モノクロ/.test(c)) return { bg: '#101010', fg: '#f0f0f0', accent: '#ffffff', good: '#d8d8d8', bad: '#777777' };
  if (/金色/.test(c)) return { bg: '#1c1406', fg: '#fff4d6', accent: '#ffcc33', good: '#ffe27a', bad: '#e0603a' };
  if (/青い/.test(c)) return { bg: '#06203d', fg: '#e8f4ff', accent: '#5cc8ff', good: '#9fe7ff', bad: '#ff7a59' };
  return { bg: '#1b2a6b', fg: '#ffffff', accent: '#ffcf3d', good: '#7dffb0', bad: '#ff5d73' };
}
/** the level the harness gives the code (1..4) from the level tag */
export function gameLevel(tags: SpellTag[]): number {
  const l = tags.find((t) => t.group === 'level')?.ja;
  return l === 'かんたん' ? 1 : l === 'むずかしい' ? 3 : l === 'とてもむずかしい' ? 4 : 2;
}
/** the player character the harness draws (G.hero) from the hero tag */
export function gameHero(tags: SpellTag[]): string {
  const h = tags.find((t) => t.group === 'hero')?.ja ?? '';
  return /猫/.test(h) ? 'cat' : /犬/.test(h) ? 'dog' : /うさぎ/.test(h) ? 'rabbit' : /ロボ/.test(h) ? 'robot' : /宇宙船|ロケット/.test(h) ? 'ship' : /ドラゴン/.test(h) ? 'dragon' : 'blob';
}

/** the sandbox's policy: nothing from the network, nothing but its own inline script and style */
export const GAME_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'none'; media-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/**
 * The whole game page for the sandboxed iframe (srcdoc; sandbox="allow-scripts" only): the fixed harness — canvas sized
 * to the frame, touch + keyboard input, the score, the result and the restart, errors caught — around the generated
 * `function game(G)`. It talks to the app only by postMessage: ready, a heartbeat each second, an error.
 */
export function gameDocument(o: { code: string; title: string; howTo: string; tags: SpellTag[] }): string {
  const cfg = JSON.stringify({ color: gamePalette(o.tags), level: gameLevel(o.tags), hero: gameHero(o.tags), title: o.title.slice(0, 24), howTo: o.howTo.slice(0, 60) }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${GAME_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>${esc(o.title)}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000;touch-action:none;-webkit-user-select:none;user-select:none;font-family:"Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif}canvas{display:block;width:100%;height:100%}</style></head>
<body><canvas id="c"></canvas><script>
(function(){
var CFG=${cfg};
var send=function(type,extra){try{var m={obolo:"game",type:type};if(extra)for(var k in extra)m[k]=extra[k];window.parent.postMessage(m,"*");}catch(e){}};
var cv=document.getElementById("c"),ctx=cv.getContext("2d"),dpr=Math.min(2,window.devicePixelRatio||1);
var G={W:0,H:0,ctx:ctx,score:0,level:CFG.level,time:0,color:CFG.color,state:"title"};
var sw=-1,sh=-1;function size(){sw=window.innerWidth;sh=window.innerHeight;G.W=Math.max(200,sw);G.H=Math.max(200,window.innerHeight);cv.width=Math.round(G.W*dpr);cv.height=Math.round(G.H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
size();window.addEventListener("resize",size);
var I={left:false,right:false,up:false,down:false,action:false,x:0,y:0,pressed:false,tapped:false};
G.input={get left(){return I.left},get right(){return I.right},get up(){return I.up},get down(){return I.down},get action(){return I.action||I.pressed},get x(){return I.x},get y(){return I.y},get pressed(){return I.pressed},get tapped(){return I.tapped},dir:function(){return (I.right?1:0)-(I.left?1:0)}};
var keys={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",ArrowUp:"up",KeyW:"up",ArrowDown:"down",KeyS:"down",Space:"action",Enter:"action"};
window.addEventListener("keydown",function(e){var k=keys[e.code];if(k){I[k]=true;e.preventDefault();}if(k==="action")I.tapped=true;});
window.addEventListener("keyup",function(e){var k=keys[e.code];if(k){I[k]=false;e.preventDefault();}});
function pt(e){var t=e.touches&&e.touches[0]?e.touches[0]:e;I.x=t.clientX;I.y=t.clientY;}
cv.addEventListener("pointerdown",function(e){pt(e);I.pressed=true;I.tapped=true;e.preventDefault();});
cv.addEventListener("pointermove",function(e){pt(e);});
window.addEventListener("pointerup",function(){I.pressed=false;});
window.addEventListener("pointercancel",function(){I.pressed=false;});
G.addScore=function(n){G.score=Math.max(0,G.score+(+n||0));};
G.over=function(t){if(G.state==="play"){G.state="over";G.msg=String(t||"ゲームオーバー").slice(0,20);G.wait=0.6;}};
G.win=function(t){if(G.state==="play"){G.state="won";G.msg=String(t||"クリア！").slice(0,20);G.wait=0.6;}};
G.rand=function(a,b){return a+Math.random()*(b-a);};
G.clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
G.hit=function(a,b){var dx=a.x-b.x,dy=a.y-b.y,r=(a.r||0)+(b.r||0);return dx*dx+dy*dy<r*r;};
G.circle=function(x,y,r,c){ctx.fillStyle=c||G.color.fg;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill();};
G.rect=function(x,y,w,h,c){ctx.fillStyle=c||G.color.fg;ctx.fillRect(x,y,w,h);};
var FONT=getComputedStyle(document.body).fontFamily;
G.text=function(s,x,y,size,c,al){ctx.fillStyle=c||G.color.fg;ctx.font="bold "+(size||18)+"px "+FONT;ctx.textAlign=al||"center";ctx.textBaseline="middle";ctx.fillText(String(s).slice(0,40),x,y);};
G.hero=function(x,y,r){var h=CFG.hero,c=G.color.accent;ctx.save();ctx.translate(x,y);
 if(h==="ship"){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*0.8,r);ctx.lineTo(0,r*0.55);ctx.lineTo(-r*0.8,r);ctx.closePath();ctx.fill();ctx.fillStyle=G.color.good;G.circle(0,-r*0.15,r*0.25,G.color.good);ctx.restore();return;}
 if(h==="robot"){G.rect(-r*0.85,-r*0.8,r*1.7,r*1.6,c);G.rect(-r*0.08,-r*1.2,r*0.16,r*0.4,c);G.circle(0,-r*1.25,r*0.14,G.color.good);G.rect(-r*0.5,-r*0.3,r*0.3,r*0.3,G.color.bg);G.rect(r*0.2,-r*0.3,r*0.3,r*0.3,G.color.bg);ctx.restore();return;}
 if(h==="cat"||h==="rabbit"||h==="dog"||h==="dragon"){ctx.fillStyle=c;var ear=h==="rabbit"?1.9:1.35;ctx.beginPath();ctx.moveTo(-r*0.85,-r*0.2);ctx.lineTo(-r*0.55,-r*ear);ctx.lineTo(-r*0.15,-r*0.6);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*0.85,-r*0.2);ctx.lineTo(r*0.55,-r*ear);ctx.lineTo(r*0.15,-r*0.6);ctx.closePath();ctx.fill();}
 G.circle(0,0,r,c);G.circle(-r*0.35,-r*0.1,r*0.13,G.color.bg);G.circle(r*0.35,-r*0.1,r*0.13,G.color.bg);ctx.strokeStyle=G.color.bg;ctx.lineWidth=Math.max(1.5,r*0.08);ctx.beginPath();ctx.arc(0,r*0.15,r*0.25,0.2,Math.PI-0.2);ctx.stroke();ctx.restore();};
var game=null;
try{game=(/*__GAME_CODE__*/)(G);if(!game||typeof game.update!=="function"||typeof game.draw!=="function")throw new Error("no game");}catch(e){send("error",{message:String(e&&e.message||e).slice(0,200)});return;}
function start(){G.score=0;G.time=0;G.state="play";try{if(game.start)game.start();}catch(e){fail(e);}}
var failed=false;function fail(e){if(failed)return;failed=true;send("error",{message:String(e&&e.message||e).slice(0,200)});}
window.addEventListener("error",function(e){fail(e.error||e.message);});
var last=0,ready=false,beat=0;
function frame(ts){if(failed)return;if(window.innerWidth!==sw||window.innerHeight!==sh)size();var dt=last?Math.min(0.05,(ts-last)/1000):0;last=ts;
 try{
  if(G.state==="play"){G.time+=dt;game.update(dt);}
  else if(G.state==="over"||G.state==="won"){G.wait-=dt;if(G.wait<=0&&I.tapped)start();}
  else if(G.state==="title"&&I.tapped)start();
  ctx.fillStyle=G.color.bg;ctx.fillRect(0,0,G.W,G.H);
  if(G.state!=="title")game.draw();
  if(G.state==="play"||G.state==="over"||G.state==="won")G.text(String(G.score),G.W-16,24,22,G.color.fg,"right");
  if(G.state==="title"){G.text(CFG.title,G.W/2,G.H*0.38,Math.min(34,G.W/10),G.color.accent);G.text(CFG.howTo,G.W/2,G.H*0.5,Math.min(16,G.W/24),G.color.fg);G.hero(G.W/2,G.H*0.66,Math.min(30,G.W/12));G.text("タップでスタート",G.W/2,G.H*0.8,18,G.color.fg);}
  if(G.state==="over"||G.state==="won"){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,G.W,G.H);G.text(G.msg,G.W/2,G.H*0.42,Math.min(36,G.W/9),G.state==="won"?G.color.good:G.color.accent);G.text("スコア "+G.score,G.W/2,G.H*0.52,22,G.color.fg);if(G.wait<=0)G.text("タップでもう一回",G.W/2,G.H*0.62,18,G.color.fg);}
 }catch(e){fail(e);return;}
 I.tapped=false;
 if(!ready){ready=true;send("ready");}
 beat+=dt;if(beat>1){beat=0;send("beat",{score:G.score,state:G.state});}
 window.requestAnimationFrame(frame);}
window.requestAnimationFrame(frame);
})();
</script></body></html>`.replace('/*__GAME_CODE__*/', () => o.code);
}
