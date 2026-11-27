import type { Step } from './script';

/**
 * Story days 3–7 on the NEW planet homes (story session M-R330, 2026-11-27; wip/P02/c03.md D04-S005, P03/c02.md
 * D05-S005 / D05-S008b, P03/c04.md D06-S005 / D06-S007b, P04/c01.md D07-S002 / D07-S005b, P04/c01v.md D07V-S003 /
 * D07V-S004). Played only when the planet's switch is on (lib/planetHomes.ts — off by default: then each day plays its
 * steps of before, unchanged). The script's lines word for word (story-sync checks THESE: the script of now is written
 * for the new homes); the 〔画面：…〕 lines are the notices.
 *
 * M-R341 / M-R336 (handoff planets-08): each planet's resident becomes {neo}'s oshi (OSHI_NOTES) and the seven Sushimon
 * board the rocket on day 3 (D3_SUSHIMON) — on both versions of a day (journeyNotes, M-R343); the new homes show the
 * roster of that day (storyCast).
 *
 * What changes against the days of before: the planet is no longer told over a still with a 〔…をタップする〕 button —
 * the 'home' step opens the planet's new home (components/planetTemplate) with the people the script names
 * (lib/planetTemplate/storyCast.ts): first the resident's own place (`host`: touch what came to them, 〔次へ〕), then
 * {neo}'s own place (`neo`: the inviter's — when someone invited — and KIMORIN⭐︎'s works come around; two fingers pinch
 * up to the sky; tapping {neo}'s own place opens it — `until: 'door'` — and the story goes on from inside).
 */

/** a scene's steps of before replaced by its steps for the new homes (a scene = from its 'scene' step to the next one) */
export function withNewHomes(steps: readonly Step[], scenes: Record<string, Step[]>): Step[] {
  const out: Step[] = [];
  let skip = false;
  for (const s of steps) {
    if (s.t === 'scene') {
      const fresh = scenes[s.id];
      skip = !!fresh;
      if (fresh) out.push(...fresh);
    }
    if (!skip) out.push(s);
  }
  return out;
}

// ───────────────────────────── day 3: Saturn (D04-S005) ─────────────────────────────
/** the one line M-R330 changed, and the screen note after it (the 'home' steps themselves show the new home by the switch) */
export const D3_GROOVE_BEFORE = '聞き終わったコロリンは、溝にしまわれるZE。再生ボタンを押せば、溝のコロリンが、針のマイクの前で、全部まとめて歌うZE!!';
export const D3_GROOVE_NOW = '聞き終わったコロリンは、溝にしまわれるZE。再生ボタンを押せば、レコードに降りられて、コロリンが溝を流れてきて、順番に喋ってくれるZE!!';
export const D3_GROOVE_NOTE = 'コロリンは、指でつまんで投げられます。右上の再生ボタンで、レコードに降りて、コロリンの声をまとめて聞けます';
/**
 * D04-S005c's screen note of the home of before: it names 〔▶ 全部流す〕 and the needle's mic. The new Saturn home has
 * neither (its ▶ at the top right drops onto the record and the kororins ride the groove — told by D3_GROOVE_NOTE), so
 * the new-home day leaves this one note out (story session M-R340: shown only where the two controls exist).
 */
export const D3_PLAY_ALL_NOTE = '転がっているコロリンは、前に開いてから降ってきた新しいコロリンです。つつく・はじく・投げると喋って、溝にしまわれます。〔▶ 全部流す〕で、溝のコロリンを、針のマイクの前でまとめて聞けます';
export function day3NewHomes(steps: readonly Step[]): Step[] {
  return steps.flatMap((s): Step[] => {
    if (s.t === 'say' && s.text === D3_GROOVE_BEFORE) return [{ ...s, text: D3_GROOVE_NOW }, { t: 'notice', text: D3_GROOVE_NOTE }];
    if (s.t === 'notice' && s.text === D3_PLAY_ALL_NOTE) return [];
    return [s];
  });
}

// ───────────────────────────── M-R341: the oshi roster ─────────────────────────────
/**
 * 〔画面：〇〇が、{neo}の推しになった｜推しは、どの星でも、{neo}の島に遊びに来ます〕 — the last line of the scene where a
 * planet's resident first appears (the script's place for it). M-R343: shown whether the planet's new home is switched
 * on or not, so it is part of the day itself (journeyNotes) — the days of before and the new-home days both carry it.
 * The script's own text; its decision tag 「（M-R341）」, which the script carries inside five of these notes, is not shown.
 */
export const OSHI_LINE = '推しは、どの星でも、{neo}の島に遊びに来ます';
export const OSHI_NOTES: Record<3 | 4 | 5 | 6 | 7, { scene: string; who: string }> = {
  3: { scene: 'D04-S003', who: 'たこ焼きブラザーとたこ焼きシスター' },
  4: { scene: 'D05-S002', who: '大根カイザー' },
  5: { scene: 'D06-S003', who: 'フリージー' },
  6: { scene: 'D07-S002', who: 'ヒポキン' },
  7: { scene: 'D07V-S003', who: 'ボスG・ロングG・ハットG' },
};
export const oshiNote = (who: string): string => `${who}が、{neo}の推しになった｜${OSHI_LINE}`;
/** the note as the last thing of scene `o.scene` (just before the next scene starts) */
export function withOshi(steps: readonly Step[], o: { scene: string; who: string }): Step[] {
  const out: Step[] = [];
  let inScene = false;
  let done = false;
  const note = (): Step[] => [{ t: 'se', sound: 'sparkle' }, { t: 'notice', text: oshiNote(o.who) }];
  for (const s of steps) {
    if (s.t === 'scene') {
      if (inScene && !done) {
        out.push(...note());
        done = true;
      }
      inScene = s.id === o.scene && !done;
    }
    out.push(s);
  }
  return out;
}
/**
 * What M-R341 / M-R336 add to a day whichever home the planet has (M-R343): on day 3 the seven Sushimon board the
 * rocket (after 〔ロケットに乗る〕), and on days 3–7 the planet's resident becomes {neo}'s oshi.
 */
export function journeyNotes(day: 3 | 4 | 5 | 6 | 7, steps: readonly Step[]): Step[] {
  const base = day === 3 ? steps.flatMap((s): Step[] => (s.t === 'action' && s.label === D3_BOARD ? [s, ...D3_SUSHIMON] : [s])) : steps;
  return withOshi(base, OSHI_NOTES[day]);
}

// ───────────────────────────── day 3: the Sushimon board the rocket (M-R336, D04-S002b) ─────────────────────────────
/** the button the scene follows */
export const D3_BOARD = 'ロケットに乗る';
const SUSHI_ROW = ['sushi-shari', 'sushi-gari', 'sushi-sapon', 'sushi-ebi', 'sushi-uni', 'sushi-ika', 'sushi-kani'];
export const D3_SUSHIMON: Step[] = [
  // 月の広場の発射台。{neo}とKIMORIN、{bati}とうんちピンポンくんが、タラップに足をかけた、その時
  { t: 'sprite', image: null },
  { t: 'se', sound: 'footsteps' },
  { t: 'say', who: '？？？', text: 'ちょっと待て！' },
  // 広場の向こうから、お寿司のネタたちが、ころがるように走ってくる。先頭は、海苔の帯をなびかせたシャリのかたまり。そのうしろに、
  // ふわふわのガリ、四角いサーモン、まるいエビ、イガイガのウニ、白いイカ、ハサミを上げたカニ
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: '……お寿司が、走ってきました。' },
  { t: 'sprite', image: SUSHI_ROW.slice(0, 4) },
  { t: 'say', who: 'サーぽん', text: 'ぼくたちも、ロケットに乗るだポン！' },
  { t: 'say', who: 'しゃりお', text: 'ぼくら、スシモン！　いっしょに、星を見に行くんだ！' },
  { t: 'say', who: 'ガリみ♡', text: '土星、ガリみも行きたーい♡' },
  { t: 'say', who: 'えびすけ', text: 'お、置いてかないでほしいっす……！' },
  { t: 'sprite', image: SUSHI_ROW.slice(4) },
  { t: 'say', who: 'ウニまる', text: '……（もじもじ）……い、いっしょに、いい？' },
  { t: 'say', who: 'いかチョロ', text: 'チョロっと乗せてくれれば、それでいいからさ〜' },
  { t: 'say', who: 'かにぶぅ', text: 'ぶぅ！（ハサミを高く上げる）' },
  { t: 'sprite', image: 'kimorin-sun' },
  { t: 'say', who: 'KIMORIN', text: 'かわいいので、許可します。' },
  { t: 'sprite', image: '@bati' },
  { t: 'say', who: 'バティ', text: '{neo}！　みんな、{neo}の作るもの、見たいんだって！' },
  // スシモンたちが、一体ずつ、{neo}の前でぴょんと跳ねる。そのたびに、小さな♡が浮かぶ
  { t: 'sprite', image: SUSHI_ROW.slice(0, 4) },
  { t: 'se', sound: 'boing' },
  { t: 'wait', s: 0.9 },
  { t: 'sprite', image: SUSHI_ROW.slice(4) },
  { t: 'se', sound: 'boing' },
  { t: 'wait', s: 0.9 },
  { t: 'se', sound: 'sparkle' },
  { t: 'notice', text: oshiNote('スシモンの7体') },
  // みんなでタラップをのぼる。スシモンたちは、窓ぎわの席に、ぎゅうぎゅうに並んで座る
];

// ───────────────────────────── day 4: Jupiter ─────────────────────────────
export const D4_NEW: Record<string, Step[]> = {
  // D05-S005 蝶の森：大根カイザーの木（その人の場所）。まわりに、ダチと推しの蝶
  'D05-S005': [
    { t: 'scene', id: 'D05-S005' },
    { t: 'bgm', track: 'jupiter-play' },
    { t: 'still', image: 's/jupiter-forest' }, // 見わたすかぎりの大森林。一本一本の木の幹に、小さな扉と名札
    { t: 'caption', text: '木星の、蝶の森' },
    { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
    { t: 'say', who: '大根カイザー', text: '木星は、命が宿る星ダ。' },
    { t: 'say', who: '大根カイザー', text: '木星には、一人に一本、自分の木があるダ。' },
    { t: 'say', who: '大根カイザー', text: 'ダチや、推している人がアートを飛ばすと、蝶になって、自分の木のまわりに、飛んでくるダ。' },
    { t: 'say', who: '大根カイザー', text: '君が見た風景だったり、今日食べたご飯だったり。そんな何気ない日常でも、命を宿し、蝶になって、思い出になっていくのダ。' },
    { t: 'say', who: '大根カイザー', text: '百聞は、一見にしかず、ダ。触ってみるダ。' },
    { t: 'notice', text: '蝶をタップすると、その蝶のアートが大きく見られます' },
    // 新しいホーム：大根カイザーの木。丸いサングラスの蝶（KIMORIN⭐︎、『プリプリ・ボカン』）が舞っている
    { t: 'home', planet: 'jupiter', place: 'host' },
    { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
    { t: 'say', who: 'KIMORIN', text: '……百聞は、一見にしかず。いい言葉ですね。今日から、私の言葉にしましょう。' },
    { t: 'say', who: 'KIMORIN', text: '……それより、私の蝶が、なぜ大根さんの木に？' },
    { t: 'say', who: '大根カイザー', text: '推しているからダ。' },
    { t: 'say', who: 'KIMORIN', text: '……私、また、推されていましたか。' },
    { t: 'say', who: '大根カイザー', text: '蝶は、88時間、飛んだら、その人の木へ帰っていくダ。' },
  ],
  // D05-S008b {neo}の木とアトリエ
  'D05-S008b': [
    { t: 'scene', id: 'D05-S008b' },
    { t: 'bgm', track: 'jupiter-mm' },
    { t: 'still', image: 's/jupiter-daikon' }, // 大根カイザーの木のとなりに、まだ若い一本の木。名札『{neo}』
    { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
    { t: 'say', who: '大根カイザー', text: 'こっちが、{neo}の木ダ。' },
    // ひらり。羅針盤の封印の蝶（招待者。いなければ、出さない：M-R343）。続いて、丸いサングラスの蝶
    { t: 'say', who: 'KIMORIN', text: '……ダチですから。当然、来ますね。' },
    { t: 'notice', text: '{neo}の木のまわりには、ダチと推しのアートが、蝶になって88時間あつまります' },
    { t: 'say', who: '大根カイザー', text: '森の上から見わたすと、まだ知らない誰かのアートが集まる広場が、いっぱいあるダ。気に入ったら、推すといいダ。次から、{neo}の木にも飛んでくるダ。' },
    { t: 'notice', text: '2本の指でつまむと、空から森を見わたせます。広場に降りると、知らない人のアートを見られます。♡を押すと、その人の蝶が、{neo}の木にも飛んでくるようになります' },
    { t: 'say', who: '大根カイザー', text: 'そして、木の扉を開けてみるダ。' },
    { t: 'notice', text: '{neo}の木の扉をタップする' },
    // 新しいホーム：{neo}の木。扉（自分の場所）をタップすると、木の中のアトリエ
    { t: 'home', planet: 'jupiter', place: 'neo', until: 'door', sent: { key: 'f_d05_sent_jacket', value: 'send' } },
    { t: 'sprite', image: ['kaiser1', 'kimorin-sun'] },
    { t: 'say', who: '大根カイザー', text: 'ここが、{neo}のアトリエダ。{neo}の作ったアートは、ここに、ずっと飾られるダ。' },
    { t: 'branch', key: 'f_d05_sent_jacket', cases: { send: 'home-send' }, otherwise: 'home-keep' },
    { t: 'label', id: 'home-send' },
    // いちばん大きな額に、今朝、{neo}が月から飛ばしたアートが、もう飾られている
    { t: 'say', who: 'KIMORIN', text: '……悪くないですね。私の次くらいには。' },
    { t: 'goto', id: 'home-end' },
    { t: 'label', id: 'home-keep' },
    { t: 'say', who: '大根カイザー', text: '飛ばすのは、いつでもいいダ。アートは、Bluenaの中で、待っているダ。' },
    { t: 'label', id: 'home-end' },
    { t: 'say', who: 'KIMORIN', text: '……私のアトリエの額は、もっと大きいのが、よろしいかと。' },
    { t: 'say', who: '大根カイザー', text: '同じ大きさダ。' },
    { t: 'notice', text: '木のまわりの蝶はダチと推しのアート（88時間）、木の中のアトリエは{neo}のアート（ずっと）。アトリエの見た目は、あとで月の工房で{bati}と話して変えられます' },
  ],
};

// ───────────────────────────── day 5: Mercury ─────────────────────────────
export const D5_NEW: Record<string, Step[]> = {
  // D06-S005 音楽の船の海：フリージーの島（その人の場所）。まわりに、ダチと推しの音船
  'D06-S005': [
    { t: 'scene', id: 'D06-S005' },
    { t: 'bgm', track: 'mercury-play' },
    { t: 'still', image: 's/mercury-port' }, // 見わたすかぎりの海に、小さな島が点々。どの島にも、小さな家と桟橋と名札
    { t: 'caption', text: '水星の、音楽の船の海' },
    { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
    { t: 'say', who: 'フリージー', text: '水星には、一人に一つ、自分の島がある。' },
    { t: 'say', who: 'フリージー', text: 'ダチや、推してる人が曲を飛ばすと、音船になって、自分の島のまわりに、やってくる。' },
    { t: 'say', who: 'フリージー', text: '実はな、音に乗っけると、100倍のパワーを持つ。' },
    { t: 'say', who: 'KIMORIN', text: '百倍。根拠は？' },
    { t: 'say', who: 'フリージー', text: '聴けば、わかる。' },
    { t: 'notice', text: '船をタップすると、その船の曲が聴けます（押した時だけ鳴ります）' },
    // 新しいホーム：フリージーの島。帆に『プリプリ・ボカン』の船（KIMORIN⭐︎）
    { t: 'home', planet: 'mercury', place: 'host' },
    { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
    { t: 'say', who: 'KIMORIN', text: '……二回目でも、泣けますね。……ところで、なぜ私の船が、冷蔵庫の島に？' },
    { t: 'say', who: 'フリージー', text: '推してるからだ。' },
    { t: 'say', who: 'KIMORIN', text: '……私、どの星でも、推されていますね。' },
    { t: 'say', who: 'フリージー', text: '船は、88時間、島のまわりを回ったら、その人の島へ帰っていく。' },
  ],
  // D06-S007b {neo}の島
  'D06-S007b': [
    { t: 'scene', id: 'D06-S007b' },
    { t: 'bgm', track: 'mercury' },
    { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
    { t: 'say', who: 'フリージー', text: '次は、{neo}の島だ。' },
    { t: 'se', sound: 'whoosh' }, // 汽笛。海の底から五線の輪。白い砂とヤシの木の、小さな島がせり上がる。浜の立て札に『{neo}』
    { t: 'say', who: 'KIMORIN', text: '……島とは、生えるものだったのですね。' },
    // ぽう、と汽笛。羅針盤の封印の船（招待者。いなければ、出さない：M-R343）。続いて、帆に『プリプリ・ボカン』の船
    { t: 'say', who: 'KIMORIN', text: '……ダチですから。当然、来ますね。' },
    { t: 'notice', text: '{neo}の島のまわりには、ダチと推しの曲が、音船になって88時間やってきます' },
    { t: 'say', who: 'フリージー', text: '空から見ろ。まだ知らない誰かの曲が流れ着く島が、いくらでもある。気に入ったら推せ。次から、{neo}の島にも来る。' },
    { t: 'notice', text: '2本の指でつまむと、空から海を見わたせます。島に降りると、知らない人の曲を聴けます。♡を押すと、その人の船が、{neo}の島にもやってくるようになります' },
    { t: 'say', who: 'フリージー', text: '家に入ってみろ。' },
    { t: 'notice', text: '島の小さな家をタップする' },
    // 新しいホーム：{neo}の島。家（自分の場所）をタップすると、レコードの並ぶ浜
    { t: 'home', planet: 'mercury', place: 'neo', until: 'door', sent: { key: 'f_d06_sent_song', value: 'sail' } },
    { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
    { t: 'say', who: 'フリージー', text: '{neo}の作った曲は、ここに、レコードになって、ずっと並ぶ。' },
    { t: 'branch', key: 'f_d06_sent_song', cases: { sail: 'isle-sail' }, otherwise: 'isle-keep' },
    { t: 'label', id: 'isle-sail' },
    // 棚のいちばん手前に、今朝、{neo}が月から飛ばした曲のレコードが、もう一枚、立っている
    { t: 'sprite', image: '@bati' },
    { t: 'say', who: 'バティ', text: 'ボクたちの歌、ちゃんと並んでる！' },
    { t: 'goto', id: 'isle-end' },
    { t: 'label', id: 'isle-keep' },
    { t: 'say', who: 'フリージー', text: '飛ばすのは、いつでもいい。' },
    { t: 'label', id: 'isle-end' },
    { t: 'notice', text: '島のまわりの船はダチと推しの曲（88時間）、島の家の棚は{neo}の曲（ずっと）。島の見た目は、あとで月の工房で{bati}と話して変えられます' },
    { t: 'sprite', image: ['freezy', 'kimorin-sun'] },
    { t: 'say', who: 'フリージー', text: '{neo}の日常も、立派な歌になる。また聴かせてくれ。' },
  ],
};

// ───────────────────────────── day 6: Mars ─────────────────────────────
/** D07-S002 from 「火星は、映像の星だ。」 on (the flight and the arrival before it stay the day's own steps) */
export const D6_STUDIOS: Step[] = [
  { t: 'say', who: 'ヒポキン', text: '火星は、映像の星だ。' },
  { t: 'say', who: 'ヒポキン', text: '火星には、一人に一つ、自分のスタジオがある。' },
  { t: 'say', who: 'ヒポキン', text: 'ダチや、推してるやつが映像を飛ばすと、そいつがUFOに乗って、自分のスタジオの空へ、飛んでくる。' },
  { t: 'se', sound: 'knock' }, // 指をパチン。ヒポキンのスタジオの空に、小さなUFOが何機も、すいすい飛んでいる
  { t: 'bgm', track: 'mars-play' },
  { t: 'notice', text: 'UFOをタップすると、UFOがBluenaの光で、空にその人の映像を映します' },
  // 新しいホーム：ヒポキンのスタジオ。金色の滑り台のマークのUFO（KIMORIN⭐︎）
  { t: 'home', planet: 'mars', place: 'host' },
  { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……空じゅうの、注目の的ですね。……ところで、なぜ私のUFOが、カバのスタジオに？' },
  { t: 'say', who: 'ヒポキン', text: '推してるからだ。' },
  { t: 'say', who: 'KIMORIN', text: '……私、全部の星で、推されていますね。' },
  { t: 'say', who: 'ヒポキン', text: 'UFOは、88時間、飛んだら、そいつのスタジオへ帰る。' },
];
export const D6_NEW: Record<string, Step[]> = {
  // D07-S005b {neo}のスタジオ
  'D07-S005b': [
    { t: 'scene', id: 'D07-S005b' },
    { t: 'bgm', track: 'mars' },
    { t: 'still', image: 's/arr-mars-city' }, // ヒポキンのスタジオのとなりに、まだ新しい四角いスタジオ。屋根の名札に『{neo}』
    { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
    { t: 'say', who: 'ヒポキン', text: 'ここが、{neo}のスタジオだ。' },
    // ひゅうん。羅針盤の封印のUFO（招待者。いなければ、出さない：M-R343）。続いて、金色の滑り台のマークのUFO
    { t: 'say', who: 'KIMORIN', text: '……ダチですから。当然、来ますね。' },
    { t: 'notice', text: '{neo}のスタジオの空には、ダチと推しが、映像を連れて、UFOで88時間やってきます' },
    { t: 'say', who: 'ヒポキン', text: '上から見りゃ、まだ知らないやつの映像が集まる地区が、いくつもある。気に入ったら推せ。次から、{neo}の空にも来る。' },
    { t: 'notice', text: '2本の指でつまむと、空から街を見わたせます。地区に降りると、知らない人の映像を見られます。♡を押すと、その人のUFOが、{neo}のスタジオにも来るようになります' },
    { t: 'say', who: 'ヒポキン', text: '中に入れ。' },
    { t: 'notice', text: '{neo}のスタジオの扉をタップする' },
    // 新しいホーム：{neo}のスタジオ。扉（自分の場所）をタップすると、中の上映室
    { t: 'home', planet: 'mars', place: 'neo', until: 'door', sent: { key: 'f_d07_sent_mv', value: 'send' } },
    { t: 'sprite', image: ['hipokin', 'kimorin-sun'] },
    { t: 'say', who: 'ヒポキン', text: '{neo}の作った映像は、ここに、ずっとある。Bluenaで、映せ。' },
    { t: 'branch', key: 'f_d07_sent_mv', cases: { send: 'studio-send' }, otherwise: 'studio-keep' },
    { t: 'label', id: 'studio-send' },
    // KIMORINがBluenaを光らせる。今朝、{neo}が月から飛ばした一本が、壁いっぱいに映る
    { t: 'say', who: 'ヒポキン', text: '……いい画だ。' },
    { t: 'goto', id: 'studio-end' },
    { t: 'label', id: 'studio-keep' },
    { t: 'say', who: 'ヒポキン', text: '飛ばすのは、いつでもいい。' },
    { t: 'label', id: 'studio-end' },
    { t: 'notice', text: 'スタジオの空のUFOはダチと推しの映像（88時間）、スタジオの中の上映室は{neo}の映像（ずっと）。スタジオの見た目は、あとで月の工房で{bati}と話して変えられます' },
    { t: 'say', who: 'KIMORIN', text: 'ご覧なさい。土星、木星、水星、火星。四つの星に、作って、飛ばしきりました。……飛ばしきったケン!!' },
    { t: 'say', who: 'KIMORIN', text: '……失礼。少々、熱くなりました。' },
    { t: 'se', sound: 'knock' }, // ヒポキンが、指を鳴らす。パチン
    { t: 'say', who: 'ヒポキン', text: '{neo}の毎日も、一本の映画になる。\nまた見せに来い。' },
  ],
};
/** D07-S002's steps of before from 「火星は、映像の星だ。……見てみろ。」 to the scene's end are replaced by D6_STUDIOS */
export const D6_STUDIOS_FROM = '火星は、映像の星だ。……見てみろ。';

// ───────────────────────────── day 7: Venus ─────────────────────────────
/** D07V-S003 from 「ここは、ラジオの星だ。」 on (the flight and the arrival before it stay the day's own steps) */
export const D7_BOOTHS: Step[] = [
  { t: 'say', who: 'ボスG', text: 'ここは、ラジオの星だ。' },
  { t: 'say', who: 'ボスG', text: '金星の雲の上には、一人に一つ、自分の放送ブースがある。' },
  { t: 'say', who: 'ボスG', text: 'ダチや、推してるやつが番組を飛ばすと、電波の輪になって、自分のブースのまわりに、漂ってくる。……近づけば、聞こえる。' },
  { t: 'cam', move: 'out' },
  { t: 'notice', text: '電波の輪をタップすると、その番組が聞こえます' },
  // 新しいホーム：ボスGのブース。ひときわ大きな声の番組（KIMORIN⭐︎：すね毛、すね毛、すね毛楽しい！）
  { t: 'home', planet: 'venus', place: 'host' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……遠くからでも、聞こえますね。さすが、私です。……ところで、なぜ私の番組が、ゴリラさんのブースに？' },
  { t: 'say', who: 'ボスG', text: '推してるからだ。' },
  { t: 'sprite', image: ['hatg', 'bossg', 'longg'] },
  { t: 'say', who: 'ハットG', text: '推してる。' },
  { t: 'say', who: 'ロングG', text: '推してるわ。' },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'KIMORIN', text: '……私、宇宙じゅうで、推されていますね。' },
  { t: 'say', who: 'ボスG', text: '……音量は、みんな、同じだ。' },
  { t: 'say', who: 'ボスG', text: '88時間、漂ったら、電波は、そいつのブースへ帰る。' },
];
export const D7_BOOTHS_FROM = 'ここは、ラジオの星だ。……近づけば、聞こえる。';
/** D07V-S004 up to 「……生で、やりたくなったら、いつでも来い。」 (the stamp and the night after it stay the day's own steps) */
export const D7_BOOTH: Step[] = [
  { t: 'scene', id: 'D07V-S004' },
  { t: 'bgm', track: 'night' },
  { t: 'still', image: 's/venus-night' }, // ボスGのブースのとなりに、まるいガラスの小さなブース。屋根の名札に『{neo}』
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: 'ここが、{neo}のブースだ。' },
  // ふわり。羅針盤の封印の電波の輪（招待者。いなければ、出さない：M-R343）。続いて、すね毛の声の輪
  { t: 'say', who: 'KIMORIN', text: '……ダチですから。当然、来ますね。' },
  { t: 'notice', text: '{neo}のブースのまわりには、ダチと推しの番組が、電波の輪になって88時間漂ってきます' },
  { t: 'say', who: 'ボスG', text: '雲の上には、まだ知らないやつの番組が集まる放送局が、いくつもある。気に入ったら推せ。次から、{neo}のブースにも来る。' },
  { t: 'notice', text: '2本の指でつまむと、空から雲の海を見わたせます。放送局に降りると、知らない人の番組を聴けます。♡を押すと、その人の電波が、{neo}のブースにも漂ってくるようになります' },
  { t: 'say', who: 'ボスG', text: '中に入れ。' },
  { t: 'notice', text: '{neo}のブースの扉をタップする' },
  // 新しいホーム：{neo}のブース。扉（自分の場所）をタップすると、マイクと棚
  { t: 'home', planet: 'venus', place: 'neo', until: 'door', sent: { key: 'f_d07v_show', value: 'send' } },
  { t: 'sprite', image: ['bossg', 'kimorin-sun'] },
  { t: 'say', who: 'ボスG', text: '{neo}の作った番組は、この棚に、ずっと並ぶ。いつでも、聴き返せる。' },
  { t: 'branch', key: 'f_d07v_show', cases: { send: 'booth-send' }, otherwise: 'booth-keep' },
  { t: 'label', id: 'booth-send' },
  // 棚のいちばん手前に、今朝、{neo}が月から飛ばした番組のテープが、もう一本、立っている
  { t: 'say', who: 'ボスG', text: '……いい番組だ。' },
  { t: 'goto', id: 'booth-end' },
  { t: 'label', id: 'booth-keep' },
  { t: 'say', who: 'ボスG', text: '飛ばすのは、いつでもいい。' },
  { t: 'label', id: 'booth-end' },
  { t: 'notice', text: 'ブースのまわりの電波はダチと推しの番組（88時間）、ブースの中の棚は{neo}の番組（ずっと）。ブースの見た目は、あとで月の工房で{bati}と話して変えられます' },
];
export const D7_BOOTH_UNTIL = '……生で、やりたくなったら、いつでも来い。';

/**
 * A scene's steps of before with a stretch replaced: from the 'say' whose text is `from` (that step too) up to the 'say'
 * whose text is `until` (not that step; none: the scene's end) → `fresh`. Used where a scene keeps its flight and
 * arrival and only its planet part is told on the new home.
 */
export function replaceStretch(steps: readonly Step[], scene: string, fresh: Step[], o: { from?: string; until?: string }): Step[] {
  const out: Step[] = [];
  let inScene = false;
  let cut = false;
  for (const s of steps) {
    if (s.t === 'scene') {
      inScene = s.id === scene;
      if (cut) cut = false;
      if (inScene && !o.from) {
        // the whole head of the scene is replaced (`fresh` carries its own 'scene' step)
        out.push(...fresh);
        cut = true;
        continue;
      }
    }
    if (inScene && !cut && o.from && s.t === 'say' && s.text === o.from) {
      out.push(...fresh);
      cut = true;
    }
    if (inScene && cut && o.until && s.t === 'say' && s.text === o.until) cut = false;
    if (!cut) out.push(s);
  }
  return out;
}
