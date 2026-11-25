import { z } from 'zod';
import { MAKE_COST, type ManaPrices } from './manaPrice';
import { MakeConfirm } from './makeConfirm';
import { SpellTags, type SpellGroup, type SpellTag } from './spell';

/**
 * R13 (client 2026-11-25, docs/動画の作り方.md): 「動画生成そのものは失敗が多く高いので、このアプリでは基本やらない」. A video
 * here is **pictures that move**: a storyboard from the song → one picture per scene (painted, or the member's own) →
 * the camera moves over each picture (Ken Burns zoom / pan, 2.5D parallax from the picture's depth) → the scenes change
 * on the beat (soft fades, hard cuts, white flashes) → the lyric lines on screen → 720p on the API's CPU. No
 * video-generation model (text / image to video) is ever called for a member.
 *
 * The flow is the Moon's 「会話で始めて、スペルで決めて、会話で直す」: {bati} asks a little (what it is for, which song,
 * how the pictures move), fills the rest (VIDEO defaults in spell.ts), lays out the spell (look C) with its mana; once it
 * is made, a change of how it moves is a free re-render (videoEdit), a change that needs a new picture is a small spell.
 */

// --- the spell → the pipeline's settings ---------------------------------------------------------------------------

export const VIDEO_PURPOSES = ['mv', 'pictures', 'slideshow'] as const;
export type VideoPurpose = (typeof VIDEO_PURPOSES)[number];
export const VIDEO_CAMERAS = ['parallax', 'zoom', 'pan', 'fly', 'still'] as const;
export type VideoCamera = (typeof VIDEO_CAMERAS)[number];

export const VideoParams = z.object({
  /** mv = a new picture painted per scene; pictures = the member's own pictures (nothing painted); slideshow = a story in pictures */
  purpose: z.enum(VIDEO_PURPOSES),
  /** the member's song it rides on (the spell's source talisman) */
  songId: z.string().uuid().nullable(),
  /** how many pictures (scenes) */
  scenes: z.number().int().min(2).max(16),
  /** chorus ≈ 30 s, minute ≈ 60 s, full = the whole song (MV_MAX_SECONDS at most) */
  length: z.enum(['chorus', 'minute', 'full']),
  /** which part of the song: auto = the chorus for a short one, else the start; start; end */
  part: z.enum(['auto', 'start', 'end']),
  camera: z.enum(VIDEO_CAMERAS),
  /** how fast the camera moves and how often a picture is cut into shots */
  pace: z.enum(['slow', 'normal', 'fast']),
  /** how one picture becomes the next: a soft fade through dark, a hard cut, a white flash */
  transition: z.enum(['fade', 'cut', 'flash']),
  /** the lyric lines on screen (the song's own lines, on their times) */
  captions: z.boolean(),
  /** auto = Bati's effect per line (calm verses, big chorus); soft = calm everywhere; big = big everywhere */
  captionStyle: z.enum(['auto', 'soft', 'big']),
  /** a colour grade over the whole video (free to change) */
  grade: z.enum(['none', 'bright', 'dark', 'vivid', 'soft', 'mono']),
});
export type VideoParams = z.infer<typeof VideoParams>;

export const VIDEO_DEFAULTS: VideoParams = { purpose: 'mv', songId: null, scenes: 8, length: 'chorus', part: 'auto', camera: 'parallax', pace: 'normal', transition: 'fade', captions: true, captionStyle: 'auto', grade: 'none' };

const SONG_EN = /^song ([0-9a-f-]{36})$/i;
const has = (tags: SpellTag[], g: SpellGroup, ja: string) => tags.some((t) => t.group === g && t.ja === ja);
const one = (tags: SpellTag[], g: SpellGroup) => tags.find((t) => t.group === g)?.ja;

/** the spell's talismans as the pipeline's settings (what is not said: Bati's defaults) */
export function videoParams(tags: SpellTag[]): VideoParams {
  const purpose: VideoPurpose = has(tags, 'purpose', '絵をつなぐ') ? 'pictures' : has(tags, 'purpose', 'お話スライド') ? 'slideshow' : 'mv';
  const src = tags.find((t) => t.group === 'source');
  const songId = src ? (SONG_EN.exec(src.en)?.[1] ?? null) : null;
  const sc = one(tags, 'scenes');
  const len = one(tags, 'length');
  const cam = one(tags, 'camera');
  const tr = one(tags, 'transition');
  const colour = tags.filter((t) => t.group === 'color' || t.group === 'mood').map((t) => t.ja);
  // a grade only over the member's own pictures (painted ones are painted in those colours already)
  const grade: VideoParams['grade'] =
    purpose !== 'pictures' ? 'none' : colour.includes('モノクロ') ? 'mono' : colour.includes('あざやかな色') ? 'vivid' : colour.includes('やわらかい色') ? 'soft' : colour.includes('暗い') ? 'dark' : colour.includes('明るい') ? 'bright' : 'none';
  return {
    purpose,
    songId,
    scenes: sc === '4場面' ? 4 : sc === '12場面' ? 12 : 8,
    length: len === '1分' ? 'minute' : len === 'まるごと' ? 'full' : 'chorus',
    part: 'auto',
    camera: cam === 'ゆっくりズーム' ? 'zoom' : cam === '横に流れる' ? 'pan' : cam === '空を飛ぶカメラ' ? 'fly' : 'parallax',
    pace: cam === 'ゆっくりズーム' ? 'slow' : 'normal',
    transition: tr === 'パッと切りかえ' ? 'cut' : tr === 'ピカッと切りかえ' ? 'flash' : 'fade',
    captions: has(tags, 'caption', '歌詞を出す') && !has(tags, 'caption', '歌詞なし'),
    captionStyle: 'auto',
    grade,
  };
}

/** what a video's spell costs: painted scenes (MAKE_COST.mv) or the member's own pictures moved (MAKE_COST.mvPictures) */
export function videoCost(tags: SpellTag[], prices: Readonly<ManaPrices> = MAKE_COST): { kind: 'mv' | 'mvPictures'; mana: number } {
  return videoParams(tags).purpose === 'pictures' ? { kind: 'mvPictures', mana: prices.mvPictures } : { kind: 'mv', mana: prices.mv };
}

// --- the song: picked by its name ----------------------------------------------------------------------------------

export type VideoSong = { id: string; title: string };
const norm = (s: string) => s.replace(/[\s　、。！!？?「」『』（）()・〜~ー-]/g, '').toLowerCase();

/**
 * the member's song named in the words (「夏の海のポップにMVつけて」 → 夏の海のポップ): the longest title found inside
 * the words, else the title that shares the most of its words (at least half of it), else none
 */
export function pickSong<S extends VideoSong>(songs: readonly S[], said: string): S | null {
  const w = norm(said);
  if (!w) return null;
  const inside = songs.filter((s) => norm(s.title) && w.includes(norm(s.title))).sort((a, b) => norm(b.title).length - norm(a.title).length);
  if (inside[0]) return inside[0];
  let best: S | null = null;
  let score = 0;
  for (const s of songs) {
    const t = norm(s.title);
    if (!t) continue;
    // the longest piece of the title in the words
    let run = 0;
    for (let i = 0; i < t.length; i++) for (let j = i + 2; j <= t.length; j++) if (w.includes(t.slice(i, j))) run = Math.max(run, j - i);
    const sc = run / t.length;
    if (sc >= 0.5 && sc > score) {
      best = s;
      score = sc;
    }
  }
  return best;
}

/** the song's talisman (its name shown; the id behind it, never shown) */
export const songTag = (s: VideoSong): SpellTag => ({ ja: s.title.slice(0, 16) || '曲', en: `song ${s.id}`, group: 'source' });

/** the spell with exactly this song's talisman (and, for the member's own pictures, no painting touch) */
export function withSong(tags: SpellTag[], song: VideoSong | null): SpellTag[] {
  const rest = tags.filter((t) => t.group !== 'source');
  const own = videoParams(rest).purpose === 'pictures';
  const out = own ? rest.filter((t) => t.group !== 'style') : rest;
  return song ? [songTag(song), ...out].slice(0, 16) : out;
}

// --- the window of the song, and the scenes' times ----------------------------------------------------------------

export const VIDEO_MAX_SECONDS = 180;

/** which seconds of the song the video plays (a short one starts a moment before the first chorus line) */
export function videoWindow(p: Pick<VideoParams, 'length' | 'part'>, songSeconds: number, lyrics: readonly { t: number; chorus: boolean }[] = []): { start: number; seconds: number } {
  const total = Math.max(1, Math.min(songSeconds, 600));
  const want = p.length === 'chorus' ? 30 : p.length === 'minute' ? 60 : total;
  const seconds = Math.min(want, total, VIDEO_MAX_SECONDS);
  let start = 0;
  if (p.part === 'end') start = total - seconds;
  else if (p.part === 'auto' && p.length === 'chorus') {
    const c = lyrics.find((l) => l.chorus);
    start = c ? Math.max(0, c.t - 1) : 0;
  }
  start = Math.max(0, Math.min(start, total - seconds));
  return { start: Math.round(start * 100) / 100, seconds: Math.round(seconds * 100) / 100 };
}

/** one picture of the video: where it is kept, what it shows, its share of the time, its 2.5D move once chosen */
export type VideoScene = { url: string; tags?: string; dur: number; parallax?: { move: string; fx: number; fy: number; strength: number } | null; /** the demo's near layer (a cut-out that drifts faster) */ near?: string };
/** what a video is made of, kept with it: a change of how it moves is made again from this alone (no new picture) */
export type VideoCut = { params: VideoParams; order: number[]; scenes: VideoScene[] };

/** the scenes in their order with their seconds, filling the window (each at least 1.5 s; the shares kept) */
export function sceneTimes(cut: VideoCut, seconds: number): { k: number; dur: number }[] {
  const ks = cut.order.filter((k) => k >= 0 && k < cut.scenes.length);
  if (!ks.length) return [];
  const sum = ks.reduce((a, k) => a + Math.max(0.5, cut.scenes[k].dur || 1), 0);
  const raw = ks.map((k) => ({ k, dur: (Math.max(0.5, cut.scenes[k].dur || 1) / sum) * seconds }));
  const min = Math.min(1.5, seconds / ks.length);
  const short = raw.filter((x) => x.dur < min);
  if (short.length) {
    const lack = short.reduce((a, x) => a + (min - x.dur), 0);
    const long = raw.filter((x) => x.dur >= min);
    const room = long.reduce((a, x) => a + (x.dur - min), 0) || 1;
    for (const x of raw) x.dur = x.dur < min ? min : x.dur - ((x.dur - min) / room) * lack;
  }
  // the last one takes the rounding
  const out = raw.map((x) => ({ k: x.k, dur: Math.round(x.dur * 100) / 100 }));
  out[out.length - 1].dur = Math.round((seconds - out.slice(0, -1).reduce((a, x) => a + x.dur, 0)) * 100) / 100;
  return out;
}

// --- after it is made: the member's words → a free re-render, or a small paid redraw ----------------------------------

const KANJI: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : /^[０-９]+$/.test(s) ? Number(s.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))) : (KANJI[s] ?? 0));

/** the scenes the words point at, 0-based in the order shown (「3番目」「2つ目の場面」「最初の場面」「最後の絵」) */
export function sceneRefs(said: string, n: number): number[] {
  const out: number[] = [];
  const re = /(\d+|[０-９]+|十[一二]?|[一二三四五六七八九])\s*(番目|つ目|こ目|個目|枚目|場面目|シーン目|番の|番)|(最初|さいしょ|はじめ|一番目|1番目)の(場面|絵|シーン)|(最後|さいご|おわり|ラスト)の(場面|絵|シーン)/g;
  for (const m of said.matchAll(re)) {
    const k = m[1] ? toNum(m[1]) - 1 : m[3] ? 0 : n - 1;
    if (k >= 0 && k < n && !out.includes(k)) out.push(k);
  }
  return out;
}

/** what a free change changed (the keys of {bati}'s line) */
export type VideoChange = 'camera' | 'pace' | 'transition' | 'captions' | 'order' | 'cut' | 'length' | 'part' | 'grade';
export type VideoEditResult =
  | { kind: 'free'; params: VideoParams; order: number[]; changes: VideoChange[] }
  /** new pictures: a small spell (MAKE_COST.mvRedraw); `scenes` empty = which one is not said */
  | { kind: 'redraw'; scenes: number[] }
  | null;

const REDRAW = /描き直|かきなお|書き直|描きかえ|かきかえ|描き変え|塗り直|ぬりなお|別の絵|べつの絵|ちがう絵|違う絵|絵を変え|絵をかえ/;
const DROP = /消して|けして|カットして|削って|けずって|なくして|抜いて|ぬいて|いらない|取って|とって|外して|はずして/;

/**
 * The member's words after the video is made, read as a change. Only how it moves → `free` (re-rendered on the CPU from
 * the kept pictures: no mana). A picture to paint again → `redraw`. Anything else → null (talk, or a new spell).
 */
export function videoEdit(cut: Pick<VideoCut, 'params' | 'order'>, said: string): VideoEditResult {
  const t = said.replace(/\s+/g, '');
  const n = Math.max(cut.order.length, ...cut.order.map((k) => k + 1));
  if (REDRAW.test(t)) return { kind: 'redraw', scenes: sceneRefs(t, n).map((i) => cut.order[i] ?? i) };
  const p: VideoParams = { ...cut.params };
  let order = [...cut.order];
  const changes = new Set<VideoChange>();
  const set = <K extends keyof VideoParams>(k: K, v: VideoParams[K], c: VideoChange) => {
    if (p[k] !== v) changes.add(c);
    p[k] = v;
  };
  // the lyrics on screen
  if (/歌詞|字幕/.test(t)) {
    if (/消|なし|無し|いらない|出さない|ださない|オフ|とって|取って|外|はずして|なくして/.test(t)) set('captions', false, 'captions');
    else {
      set('captions', true, 'captions');
      if (/大きく|ハデ|派手|目立/.test(t)) set('captionStyle', 'big', 'captions');
      else if (/小さく|控えめ|ひかえめ|静か|しずか|シンプル|落ち着/.test(t)) set('captionStyle', 'soft', 'captions');
    }
  } else {
    const refs = sceneRefs(t, order.length);
    // the order: swap two, the reverse, one to the front / the end; a scene cut out
    if (refs.length >= 2 && /入れ替え|入れかえ|いれかえ|交換|こうかん|逆に/.test(t)) {
      [order[refs[0]], order[refs[1]]] = [order[refs[1]], order[refs[0]]];
      changes.add('order');
    } else if (/(逆|反対|はんたい)(の|に)?(順|じゅん)/.test(t)) {
      order = order.reverse();
      changes.add('order');
    } else if (refs.length && /(最初|さいしょ|はじめ|先頭)に/.test(t)) {
      const k = order[refs[0]];
      order = [k, ...order.filter((x, i) => i !== refs[0])];
      changes.add('order');
    } else if (refs.length && /(最後|さいご|おわり)に/.test(t)) {
      const k = order[refs[0]];
      order = [...order.filter((x, i) => i !== refs[0]), k];
      changes.add('order');
    } else if (refs.length && DROP.test(t) && order.length - refs.length >= 2) {
      order = order.filter((_, i) => !refs.includes(i));
      changes.add('cut');
    }
  }
  // the camera, and how fast it moves
  if (/パララックス|奥行き|おくゆき|立体的/.test(t)) set('camera', 'parallax', 'camera');
  else if (/ズーム/.test(t)) set('camera', 'zoom', 'camera');
  else if (/横に|よこに|パン|流れ|ながれ/.test(t)) set('camera', 'pan', 'camera');
  else if (/飛ぶ|とぶ|空から|そらから/.test(t)) set('camera', 'fly', 'camera');
  else if (/(動か|うごか)さない|止めて|とめて|じっと/.test(t)) set('camera', 'still', 'camera');
  if (/ゆっくり|ゆったり|おだやか|スロー|遅く|おそく|のんびり/.test(t)) set('pace', 'slow', 'pace');
  else if (/速く|はやく|激しく|はげしく|ダイナミック|キビキビ|きびきび|テンポよく/.test(t)) set('pace', 'fast', 'pace');
  else if (/ふつうの速さ|普通の速さ/.test(t)) set('pace', 'normal', 'pace');
  // how the scenes change
  if (/ふわっと|フェード|じわっと/.test(t)) set('transition', 'fade', 'transition');
  else if (/パッと|ぱっと|スパッと/.test(t)) set('transition', 'cut', 'transition');
  else if (/ピカッと|ぴかっと|フラッシュ|光らせ/.test(t)) set('transition', 'flash', 'transition');
  // how long, and which part of the song
  if (/まるごと|丸ごと|フル|最後まで|全部の長さ/.test(t)) set('length', 'full', 'length');
  else if (/[1１一]分/.test(t)) set('length', 'minute', 'length');
  else if (/サビだけ|30秒|短く|みじかく/.test(t)) set('length', p.length === 'full' ? 'minute' : 'chorus', 'length');
  else if (/長く|ながく/.test(t)) set('length', p.length === 'chorus' ? 'minute' : 'full', 'length');
  if (/(はじめ|最初|さいしょ|頭|あたま|イントロ)から/.test(t)) set('part', 'start', 'part');
  else if (/サビから|サビの(ところ|部分)/.test(t)) set('part', 'auto', 'part');
  else if (/後半|こうはん|終わりの(方|ほう|ところ)|ラスト(の|を)/.test(t)) set('part', 'end', 'part');
  // the colours over the whole video
  if (/モノクロ|白黒/.test(t)) set('grade', 'mono', 'grade');
  else if (/元の色|もとの色|色を戻/.test(t)) set('grade', 'none', 'grade');
  else if (/あざやか|鮮やか|カラフル/.test(t)) set('grade', 'vivid', 'grade');
  else if (/パステル|やわらかい色|ふんわりした色/.test(t)) set('grade', 'soft', 'grade');
  else if (/明るく|あかるく/.test(t)) set('grade', 'bright', 'grade');
  else if (/暗く|くらく/.test(t)) set('grade', 'dark', 'grade');
  if (!changes.size) return null;
  return { kind: 'free', params: p, order, changes: [...changes] };
}

// --- the API's bodies ------------------------------------------------------------------------------------------------

/** POST /mars/mv/:id/pictures: the member's own pictures moved (the project's materials, else the newest in Bluena) */
export const MvPicturesBody = z.object({ spell: SpellTags, confirm: MakeConfirm, from: z.literal('atelier').optional() });
export type MvPicturesBody = z.infer<typeof MvPicturesBody>;
/** POST /mars/mv/:id/edit: a free re-render with new settings / a new order (no new picture) */
export const MvEditBody = z.object({ params: VideoParams, order: z.array(z.number().int().min(0).max(31)).min(1).max(32), from: z.literal('atelier').optional() });
export type MvEditBody = z.infer<typeof MvEditBody>;
/** POST /mars/mv/:id/redraw: one or more scenes painted again from a small spell (MAKE_COST.mvRedraw), then re-rendered */
export const MvRedrawBody = z.object({ scenes: z.array(z.number().int().min(0).max(31)).min(1).max(4), spell: SpellTags, confirm: MakeConfirm, from: z.literal('atelier').optional() });
export type MvRedrawBody = z.infer<typeof MvRedrawBody>;

// --- {bati}'s questions and lines ----------------------------------------------------------------------------------

/** {bati}'s questions for a video ({songs} = two or three of the member's song names); the start's words skip some */
export const VIDEO_QUESTIONS: { group: SpellGroup; text: string; covers: SpellGroup[] }[] = [
  { group: 'purpose', covers: ['purpose'], text: 'いいね、動く絵で映像を作ろう！　なにを作る？　たとえば、きみの曲のMVとか、持ってる絵や写真をつないだ短い映像とか、お話のスライドショーとか。' },
  { group: 'source', covers: ['source'], text: 'どの曲にのせる？　たとえば、{songs}とか。曲の名前で教えてね。' },
  { group: 'camera', covers: ['camera'], text: '絵は、どんなふうに動かす？　たとえば、ゆっくりズームとか、奥行きが出るパララックスとか、横に流れるとか。' },
];

/** {bati}'s video lines as written (元気な子; the other styles in VIDEO_VARIANTS, in BATI_VARIANTS) */
export const VIDEO_LINES = {
  /** the video is made: what can be changed for free */
  done: 'できたよ！　絵が動く映像だよ。「カメラをもっとゆっくり」「歌詞は消して」みたいに言えば、マナを使わずに直せるよ。',
  /** a free change: the pictures stay, only how they move is made again */
  rerender: 'それなら、絵はそのままで、動かし方だけ作りなおすね。マナはいらないよ。',
  /** the free change is made */
  edited: '作りなおしたよ。どう？　ほかにも、言ってね。',
  /** a change that needs a new picture: its small spell */
  redraw: 'その場面は、絵から描き直すね。こういうスペルになるよ。',
  /** a redraw without saying which scene */
  whichScene: 'どの場面にする？　「3番目の場面」みたいに言ってね。',
  /** no song to put it on */
  noSong: '映像は、曲にのせて作るよ。先に、曲を作ろう。',
  /** no pictures of the member's own to move */
  noPictures: '動かせる絵が、まだブルーナにないみたい。先に、絵を作ろう。',
  /** the free changes of the day are used up */
  editLimit: '今日は、もうたくさん作りなおしたね。つづきは、また明日にしよう。',
  /** it could not be made: the mana is back */
  failed: 'ごめん、映像がうまくできなかった。マナは返したよ。もう一回、頼んでくれる？',
} as const;
export const VIDEO_LINE_TEXTS: string[] = [...Object.values(VIDEO_LINES), ...VIDEO_QUESTIONS.map((q) => q.text)];
