import { gameLevel, type ChapterView } from './craft';
import type { SpellTag } from './spell';

/**
 * The browser demo's (and the API's no-key) stand-ins for books and games: canned chapters filled with the spell's
 * world and hero, and a small canned game whose speed, enemies and goal follow the spell — so the review shots need no
 * model. Never used when a model is set up.
 */
const w = (tags: SpellTag[], g: SpellTag['group'], dflt: string) => tags.find((t) => t.group === g)?.ja ?? dflt;

const CHAPTERS: { title: string; text: string; summary: string }[] = [
  {
    title: 'はじまりの音',
    summary: '{world}に住む{hero}は、夜ふけに聞こえたふしぎな鈴の音を追いかけ、光る羽根を見つける。',
    text: `{world}の夜は、いつも少しだけ、にぎやかだ。
屋根の上では風が歌い、石だたみの道では、落ち葉がこそこそと内緒話をしている。

その夜、{hero}は、ねむれずにいた。
窓をあけると、ひんやりした空気といっしょに、聞いたことのない音が流れこんできた。
チリン、チリン。
鈴の音だ。でも、こんな時間に、鈴を鳴らす人なんていない。

「……だれ？」
返事のかわりに、音はもう一度、遠くで鳴った。まるで「こっちだよ」と呼ぶみたいに。

{hero}は上着をはおって、そっと家を出た。
月あかりが道を白くてらしている。音は、町はずれの古い時計塔のほうから聞こえてくる。
歩くたびに、胸がどきどきした。こわいのとは、少しちがう。何かが始まる前の、あのくすぐったい感じだ。

時計塔の前まで来ると、音はぴたりとやんだ。
かわりに、足もとで何かが、ぽうっと光っていた。
拾いあげてみると、それは一枚の羽根だった。手のひらくらいの大きさで、ほのかに温かい。
羽根のふちには、小さな文字がきざまれていた。

『この音が聞こえたなら、きみは選ばれた』

「選ばれたって、なにに？」
{hero}がつぶやいたとき、時計塔の針が、ありえない方向へ、くるりと回った。
十二時をさしていたはずの針が、十三をさしている。文字盤に、十三なんて数字はなかったはずなのに。

ゴーン、と鐘が鳴った。
その音が消えるのといっしょに、{hero}の目の前に、見たことのない扉があらわれた。
木でできた、小さな扉。ドアノブには、さっきの羽根と同じ光がともっている。

{hero}は、羽根をにぎりしめた。
帰るなら、いまだ。でも――。
「ちょっとだけ。のぞくだけ」
そう自分に言いきかせて、{hero}はドアノブに手をのばした。`,
  },
  {
    title: '扉のむこう',
    summary: '扉のむこうは、時間がとまった{world}だった。{hero}はそこで、ことばを話す小さな案内役と出会う。',
    text: `扉のむこうも、{world}だった。
けれど、何かがおかしい。噴水の水は空中でとまり、飛んでいる鳥は、羽をひろげたまま動かない。
時間が、とまっている。

「やっと来たね」
声がして、{hero}はふりむいた。
噴水のふちに、手のひらほどの小さな生きものが、ちょこんとすわっていた。丸い目に、星くずみたいな光がうかんでいる。
「ぼくはリン。鈴の音は、ぼくが鳴らしたんだ」
「あなたが？　どうして、わたしを？」
「この町の時間を、もう一度動かせるのは、羽根の音が聞こえる人だけなんだ」

リンの話では、町の時計塔には、時間を動かす十三の歯車があった。
ところがある夜、そのうちの一つがなくなって、町の半分の時間がとまってしまったのだという。
「歯車をさがしてほしい。きみなら、きっと見つけられる」

{hero}は、とまったままの鳥を見上げた。
空中でかたまった水しぶきが、月の光をうけて、ガラス細工みたいにきらめいている。
きれいだ。でも、このままでは、だれも明日をむかえられない。

「……わかった。やってみる」
そう言うと、リンはうれしそうに、くるりと宙がえりをした。
「じゃあ、最初の手がかりだ。歯車は、いちばん古い記憶がねむる場所にある」
「いちばん古い記憶？」
「それは、きみが考えるんだよ」
リンは、いたずらっぽく笑った。`,
  },
  {
    title: '思い出の場所',
    summary: '{hero}は町でいちばん古い図書館で、歯車の手がかりを見つけるが、なぞの影があとをつけてくる。',
    text: `いちばん古い記憶がねむる場所。
{hero}が思いついたのは、町の図書館だった。何百年も前の本が、だれにも読まれないまま、ならんでいる場所。

図書館の中も、時間はとまっていた。
ページをめくりかけた手のまま、かたまっている司書さん。宙にういたままの、ほこり。
{hero}とリンは、足音をしのばせて、奥の書庫へむかった。

いちばん奥の棚に、一冊だけ、ほのかに光る本があった。
表紙には、あの羽根と同じ文字。ひらくと、ページのあいだから、小さな金色の歯車がころりと出てきた。
「あった！」
思わず声が出た、そのときだった。

棚のかげで、何かが動いた。
時間がとまっているはずの、この町で。
{hero}は息をのんだ。黒い影が、すうっと床をすべって、窓の外へ消えていく。

「いまの、なに？」
「……わからない」
リンの声が、少しだけふるえていた。
「でも、歯車をなくしたのは、たぶん、あいつだ」

{hero}は、金色の歯車をぎゅっとにぎった。
一つ見つけた。あと、いくつあるんだろう。そして、あの影は、なにを考えているんだろう。
窓の外で、とまっていたはずの雲が、ほんの少しだけ、動いた気がした。`,
  },
  {
    title: 'あたらしい朝',
    summary: '最後の歯車が見つかり、{world}の時間がふたたび動き出す。{hero}は、いつもとちがう朝をむかえる。',
    text: `最後の歯車は、思いがけない場所にあった。
{hero}の上着のポケット。最初の夜からずっと、羽根といっしょに、そこにあったのだ。

「さがしていたものって、いちばん近くにあるんだね」
{hero}が笑うと、リンも、しっぽをゆらして笑った。

時計塔のてっぺんで、十三個目の歯車をはめこむ。
カチリ、と音がして、針がゆっくりと動きだした。
噴水の水が落ち、鳥がはばたき、止まっていた風が、いっせいに町をかけぬけていく。

「ありがとう。きみのおかげだよ」
リンの体が、朝日にとけるみたいに、少しずつすきとおっていく。
「また会える？」
「鈴の音が聞こえたらね」

気がつくと、{hero}は自分の部屋のベッドにいた。
窓の外は、すっかり朝だった。
夢だったのかな、と思いながら手をひらくと、そこには、あの光る羽根が一枚、ちゃんとのこっていた。

チリン。
どこか遠くで、鈴の音がした気がした。`,
  },
];

/** the demo's chapter n (1-based) for the book's spell; the final chapter when the spell asks for it */
export function demoChapter(book: SpellTag[], n: number, final = false): Pick<ChapterView, 'title' | 'text'> & { summary: string; bookTitle: string } {
  const c = final ? CHAPTERS[CHAPTERS.length - 1] : CHAPTERS[Math.min(n - 1, CHAPTERS.length - 2)];
  const fill = (s: string) => s.replaceAll('{world}', w(book, 'world', 'ふしぎな町')).replaceAll('{hero}', w(book, 'hero', 'ミオ'));
  const extra = !final && n > CHAPTERS.length - 1 ? `（つづき・その${n - CHAPTERS.length + 2}）` : '';
  return { title: c.title + extra, text: fill(c.text), summary: fill(c.summary), bookTitle: `${w(book, 'world', 'ふしぎな町')}の鈴`.slice(0, 12) };
}

/**
 * the demo's small game for the spell: catch the good things, dodge the bad ones. Its level, enemies, speed-up, lives,
 * time limit and goal come from the tags (a tweak visibly changes it). Valid against validateGameCode.
 */
export function demoGame(tags: SpellTag[]): { title: string; howTo: string; code: string } {
  const has = (re: RegExp) => tags.some((t) => re.test(t.ja));
  const dodge = has(/よける/);
  const lv = gameLevel(tags);
  const enemies = (has(/敵が多い/) ? 0.55 : 0.28) + lv * 0.06;
  const speedUp = has(/スピードアップ/) ? 0.04 : 0.012;
  const lives = has(/ライフ3つ/) || !dodge ? 3 : 1;
  const goal = has(/30こ集めたら勝ち/) ? 30 : 0;
  const limit = has(/60秒/) ? 60 : 0;
  const hero = tags.find((t) => t.group === 'hero')?.ja ?? '';
  const code = `function game(G) {
  var LV = G.level, ENEMY = ${enemies.toFixed(2)}, SPEEDUP = ${speedUp}, LIVES = ${lives}, GOAL = ${goal}, LIMIT = ${limit}, DODGE = ${dodge};
  var p, things, spawn, lives, flash;
  function reset() { p = { x: G.W / 2, y: G.H - 90, r: Math.max(18, G.W / 22) }; things = []; spawn = 0; lives = LIVES; flash = 0; }
  function speed() { return (150 + LV * 55) * (1 + G.time * SPEEDUP); }
  function add() {
    var bad = Math.random() < (DODGE ? 0.75 : ENEMY);
    things.push({ x: G.rand(20, G.W - 20), y: -20, r: bad ? G.rand(14, 22) : 14, bad: bad, v: speed() * G.rand(0.8, 1.25), a: 0 });
  }
  return {
    start: function () { reset(); },
    update: function (dt) {
      p.y = G.H - 90;
      var d = G.input.dir();
      if (G.input.pressed) p.x += G.clamp(G.input.x - p.x, -900 * dt, 900 * dt);
      else p.x += d * (380 + LV * 40) * dt;
      p.x = G.clamp(p.x, p.r, G.W - p.r);
      spawn -= dt;
      if (spawn <= 0) { add(); spawn = Math.max(0.18, 0.85 - LV * 0.12 - G.time * 0.004) / (1 + ENEMY); }
      for (var i = things.length - 1; i >= 0; i--) {
        var t = things[i];
        t.y += t.v * dt; t.a += dt * 3;
        if (G.hit(t, p)) {
          things.splice(i, 1);
          if (t.bad) { lives -= 1; flash = 0.3; if (lives <= 0) G.over('ゲームオーバー'); }
          else G.addScore(1);
          continue;
        }
        if (t.y > G.H + 30) { things.splice(i, 1); if (DODGE && t.bad) G.addScore(1); }
      }
      if (flash > 0) flash -= dt;
      if (GOAL && G.score >= GOAL) G.win('クリア！');
      if (LIMIT && G.time >= LIMIT) G.win('タイムアップ！');
    },
    draw: function () {
      var c = G.ctx, k;
      for (k = 0; k < 40; k++) G.circle((k * 97) % G.W, (k * 53 + G.time * 20 * (1 + k % 3)) % G.H, 1 + (k % 2), 'rgba(255,255,255,0.25)');
      for (var i = 0; i < things.length; i++) {
        var t = things[i];
        if (t.bad) { G.circle(t.x, t.y, t.r, G.color.bad); G.circle(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.25, 'rgba(0,0,0,0.25)'); }
        else {
          c.save(); c.translate(t.x, t.y); c.rotate(t.a); c.fillStyle = G.color.good; c.beginPath();
          for (k = 0; k < 10; k++) { var rr = k % 2 ? t.r * 0.45 : t.r; c.lineTo(Math.cos(k * Math.PI / 5) * rr, Math.sin(k * Math.PI / 5) * rr); }
          c.closePath(); c.fill(); c.restore();
        }
      }
      if (flash > 0) G.rect(0, 0, G.W, G.H, 'rgba(255,60,80,0.25)');
      G.hero(p.x, p.y, p.r);
      for (k = 0; k < lives; k++) G.circle(20 + k * 22, 24, 7, G.color.bad);
      G.text('Lv' + LV, 14, 48, 13, G.color.fg, 'left');
      if (GOAL) G.text(G.score + ' / ' + GOAL, G.W / 2, 24, 16, G.color.accent);
      if (LIMIT) G.text(Math.max(0, Math.ceil(LIMIT - G.time)) + '秒', G.W / 2, 48, 14, G.color.fg);
    }
  };
}`;
  const title = `${hero || 'ほし'}の${dodge ? 'よけろ！' : 'キャッチ'}`.slice(0, 12);
  const howTo = dodge ? '左右に動いて、落ちてくるものをよけよう' : '左右に動いて、星を集めよう。赤い玉はよけてね';
  return { title, howTo, code };
}
