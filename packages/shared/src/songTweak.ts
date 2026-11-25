import { z } from 'zod';
import { lyricBlockKeys, LYRIC_SECTIONS, type LyricSection, type SongLyrics } from './lyrics';
import type { SongPhrase } from './types';

/**
 * R13 (client 2026-11-25): 「曲の生成はマナを使う。でも、できた曲を直すのは、ほとんどマナを使わないで — 『テンポを速くして
 * 2番をカット』くらいなら、こちらでできる。曲ができたら、もっと直したいか聞いて」.
 * A finished song is changed for free on our side (ffmpeg on the stems we keep: the vocal and the instrumental), never by
 * the studio: tempo, key, cutting or repeating a part (by the line times of the lyric alignment), a shorter length with a
 * fade, fades, the voice louder / softer, karaoke / vocals only, a little room. Each change is a new version made from the
 * original stems with all the ops so far (no loss from version to version); 「元に戻して」 goes one back.
 * What needs the studio (new words sung, a new melody, longer with new music, another voice, another genre) is not free:
 * {bati} says so and goes through the usual spell + yes (SONG_LINES.editPaid).
 */

/** a part of the song: a 番 (cycle 2 = 2番: its verse, pre-chorus and chorus), or a block kind (and which one of it) */
export const SongPart = z.union([z.object({ cycle: z.number().int().min(1).max(4) }), z.object({ section: z.enum(LYRIC_SECTIONS), n: z.number().int().min(1).max(8).optional() })]);
export type SongPart = z.infer<typeof SongPart>;

export const SongTweakOp = z.discriminatedUnion('op', [
  /** the whole song faster / slower (pitch kept); R17 `to`: the tempo itself (1 = as it was sung: 「元の速さで」) */
  z.object({ op: z.literal('tempo'), factor: z.number().min(0.75).max(1.3), to: z.number().min(0.7).max(1.5).optional() }),
  /** the key up / down in semitones (tempo kept) */
  z.object({ op: z.literal('key'), semitones: z.number().int().min(-5).max(5) }),
  /** a part taken out (crossfaded at the join) */
  z.object({ op: z.literal('cut'), part: SongPart }),
  /** a part once more (the chorus again at the end) */
  z.object({ op: z.literal('repeat'), part: SongPart }),
  /** at most this long (a fade-out at the end) */
  z.object({ op: z.literal('length'), seconds: z.number().min(10).max(180) }),
  z.object({ op: z.literal('fade'), in: z.number().min(0).max(8).optional(), out: z.number().min(0).max(12).optional() }),
  /** the voice / the music louder or softer (dB) */
  z.object({ op: z.literal('balance'), vocalDb: z.number().min(-12).max(12).optional(), bgmDb: z.number().min(-12).max(12).optional() }),
  /** karaoke (the music only), the voice only, or both again */
  z.object({ op: z.literal('only'), stem: z.enum(['instrumental', 'vocals', 'both']) }),
  /** a little room on the voice (0 = dry) */
  z.object({ op: z.literal('room'), amount: z.number().min(0).max(1) }),
]);
export type SongTweakOp = z.infer<typeof SongTweakOp>;

/** POST /compose/songs/:id/tweak — the member's words (parsed here by rule, else the model), the ops themselves, or undo */
export const SongTweakBody = z
  .object({
    said: z.string().trim().min(1).max(200).optional(),
    ops: z.array(SongTweakOp).min(1).max(8).optional(),
    undo: z.literal(true).optional(),
  })
  .refine((b) => [b.said, b.ops, b.undo].filter((x) => x !== undefined).length === 1, { message: 'one of said, ops or undo' });
export type SongTweakBody = z.infer<typeof SongTweakBody>;

/** a change that needs the studio (and so a spell and mana) */
export type SongPaidEdit = 'lyrics' | 'melody' | 'extend' | 'voice' | 'genre';
export interface SongTweakResult {
  /** done: a new version; undone: one back; first: nothing to go back to; paid: needs the studio; none: not a change; missing: the part is not in the song */
  /** R17 wait: the song is being split on our GPU first (stems / line times) — poll `jobId`, then send the same words again */
  status: 'done' | 'undone' | 'first' | 'paid' | 'none' | 'missing' | 'wait';
  jobId?: string;
  /** what this change did, in {bati}'s words (「テンポを速く・2番をカット」) */
  what?: string;
  paid?: SongPaidEdit;
  /** the song as it is now (the newest version) */
  song?: { url: string; seconds: number; phrases: SongPhrase[] };
  /** the lyrics as they are now (cut parts gone, a repeated part again) */
  lyrics?: SongLyrics;
  /** the ops from the original to this version, and how many versions there are */
  ops: SongTweakOp[];
  versions: number;
}

// --- the words → ops ------------------------------------------------------------------------------------------------

const MORE = /もっと|すごく|かなり|うんと|めっちゃ|とても/;
const LESS = /ちょっと|少し|すこし|ちょい/;
const NUM: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '１': 1, '２': 2, '３': 3, '４': 4, '５': 5 };
const num = (s: string | undefined) => (s ? (NUM[s] ?? Number(s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))) ?? NaN) : NaN);
const CUT = /カット|かっと|なくして|無くして|消して|けして|とって|取って|外して|はずして|削って|けずって|いらない|抜いて|ぬいて|飛ばして|とばして|なしで|なしに/;

/** the parts named in the words (2番, 間奏, イントロ, Cメロ, 大サビ, サビ …) */
function partsNamed(said: string): SongPart[] {
  const out: SongPart[] = [];
  const c = said.match(/([0-9０-９一二三四])番(?!目の?サビ)/);
  if (c && num(c[1]) >= 2) out.push({ cycle: num(c[1]) });
  const add = (section: LyricSection, re: RegExp) => {
    if (re.test(said)) out.push({ section });
  };
  add('intro', /イントロ|前奏|はじまり/);
  add('instrumental', /間奏/);
  add('guitar-solo', /ギターソロ/);
  add('bridge', /Cメロ|Ｃメロ|ブリッジ/);
  add('final-chorus', /大サビ|ラスサビ|最後のサビ/);
  add('pre-chorus', /サビ前|Bメロ|Ｂメロ/);
  if (!out.some((p) => 'section' in p && (p.section === 'final-chorus' || p.section === 'pre-chorus'))) add('chorus', /サビ/);
  add('outro', /アウトロ|後奏|エンディング/);
  return out;
}

export type TweakParse = { ops: SongTweakOp[]; undo?: boolean; paid?: SongPaidEdit };

/**
 * the member's words about a finished song → the free ops (chained: 「テンポ速くして2番カット」 is two), an undo, or the
 * change that needs the studio. Empty ops and no paid: not understood by rule (the model may try).
 */
export function parseTweak(said0: string): TweakParse {
  const said = said0.replace(/\s+/g, '');
  if (/^(元に|もとに|前に|まえに)?(戻して|もどして|戻す|もどす)|元に戻|もとに戻|もとにもど|ひとつ前|一つ前|やっぱり前|やっぱ前|アンドゥ/.test(said) && !/(歌|声|伴奏|演奏|両方).{0,3}(戻|もど)/.test(said)) return { ops: [], undo: true };
  // the studio's work (a spell and mana)
  if (/声を?(変え|かえ)|別の声|ちがう声|違う声|(男|女)の(人の)?声に|ボクの声|わたしの声|自分の声/.test(said)) return { ops: [], paid: 'voice' };
  if (/メロディ|メロディー|曲調を?(変え|かえ)|ふしを/.test(said)) return { ops: [], paid: 'melody' };
  if (/ジャンル|ロックに|ジャズに|バラードに|ポップに|EDMに|ラップに|ヒップホップに|楽器を?(変え|かえ|足|たし)/.test(said)) return { ops: [], paid: 'genre' };
  if ((/歌詞|[「『].+[」』]に|(3|３|三)番|[2-4２-４二三四]番を?(足|たし|追加|入れ|いれ|つけ|ほしい|欲しい)|続き|つづき|(長く|のばして|伸ばして|延ばして)(して)?/.test(said) && !/秒|分/.test(said) && !CUT.test(said))) {
    return { ops: [], paid: /歌詞|[「『]/.test(said) ? 'lyrics' : 'extend' };
  }
  const ops: SongTweakOp[] = [];
  // tempo — R17: 「元の速さで」 back to the tempo it was sung at (a song is delivered SONG_DEFAULT_TEMPO faster)
  if (/(元|もと|普通|ふつう|オリジナル|生成した時)の(速さ|はやさ|テンポ|スピード)|(速さ|テンポ|スピード)を?(元|もと)に|等速/.test(said)) ops.push({ op: 'tempo', factor: 1, to: 1 });
  else if (/テンポ|速く|はやく|早く|遅く|おそく|ゆっくり|スピード/.test(said)) {
    const up = /速く|はやく|早く|上げ|あげ|アップ|速め|早め/.test(said);
    const down = /遅く|おそく|ゆっくり|下げ|さげ|ダウン|遅め/.test(said);
    if (up !== down) ops.push({ op: 'tempo', factor: up ? (MORE.test(said) ? 1.18 : LESS.test(said) ? 1.05 : 1.1) : MORE.test(said) ? 0.85 : LESS.test(said) ? 0.95 : 0.9 });
  }
  // key
  const keyWords = said.match(/(キー|音程|音の高さ|高さ)を?([0-9０-９一二三四五]+)?(つ|半音|音)?(上げ|あげ|下げ|さげ|高く|低く)/) ?? said.match(/(半音)([0-9０-９一二三四五]+)?(つ)?(上げ|あげ|下げ|さげ)/);
  if (keyWords) {
    const n = num(keyWords[2]);
    const half = keyWords[3] === '半音' || keyWords[1] === '半音';
    const steps = Math.min(5, Number.isFinite(n) && n > 0 ? n : half ? 1 : 2);
    ops.push({ op: 'key', semitones: /下げ|さげ|低く/.test(keyWords[4]) ? -steps : steps });
  } else if (/(声|歌)を?(高く|低く)/.test(said)) ops.push({ op: 'key', semitones: /高く/.test(said) ? 2 : -2 });
  // cut / repeat parts
  const parts = partsNamed(said);
  if (CUT.test(said) && !/フェード|エコー|響き|リバーブ/.test(said)) for (const part of parts) ops.push({ op: 'cut', part });
  else if (/もう(一|1|１)回|もういっかい|くりかえ|繰り返|リピート|もう一度|もういちど|おかわり/.test(said)) ops.push({ op: 'repeat', part: parts[0] ?? { section: 'chorus' } });
  // length
  const sec = said.match(/([0-9０-９]+)秒/);
  const min = said.match(/([0-9０-９一二三])分(半)?/);
  if (sec || min) {
    const s = sec ? num(sec[1]) : num(min![1]) * 60 + (min![2] ? 30 : 0);
    if (Number.isFinite(s)) ops.push({ op: 'length', seconds: Math.max(10, Math.min(180, s)) });
  } else if (/短く|みじかく/.test(said) && !parts.length) ops.push({ op: 'length', seconds: -1 });
  // fades
  if (/フェードアウト|フェイドアウト|だんだん(小さく|消え)/.test(said)) ops.push({ op: 'fade', out: 5 });
  if (/フェードイン|フェイドイン|だんだん大きく(はじ|始)/.test(said)) ops.push({ op: 'fade', in: 3 });
  // karaoke / vocals only / both
  if (/カラオケ|伴奏だけ|演奏だけ|オケだけ|インスト|歌なし|歌をなく|歌を消|声を消|声なし/.test(said)) ops.push({ op: 'only', stem: 'instrumental' });
  else if (/アカペラ|歌だけ(に|で|の)|声だけ(に|で|の)|伴奏なし|伴奏を?(消|なく)/.test(said)) ops.push({ op: 'only', stem: 'vocals' });
  else if (/(歌|声|伴奏|演奏|両方).{0,3}(戻|もど)/.test(said)) ops.push({ op: 'only', stem: 'both' });
  // balance
  const v = said.match(/(歌|声|ボーカル)(だけ)?(を|の音)?(もっと)?(大きく|小さく|目立たせ|ひかえめ|控えめ)/);
  const m = said.match(/(伴奏|演奏|オケ|BGM|音楽|楽器)(を|の音)?(もっと)?(大きく|小さく|ひかえめ|控えめ)/);
  if (v || m) {
    const vDb = v ? (/大きく|目立/.test(v[5]) ? 4 : -4) * (v[4] ? 1.5 : 1) : undefined;
    const mDb = m ? (/大きく/.test(m[4]) ? 4 : -4) * (m[3] ? 1.5 : 1) : undefined;
    ops.push({ op: 'balance', ...(vDb !== undefined ? { vocalDb: vDb } : {}), ...(mDb !== undefined ? { bgmDb: mDb } : {}) });
  }
  // a little room
  if (/エコー|響き|ひびき|リバーブ|ホールみたい|広がり/.test(said)) ops.push({ op: 'room', amount: /なし|消して|とって|取って|いらない|外して|少なく|へらして|減らして/.test(said) ? 0 : MORE.test(said) ? 0.8 : 0.5 });
  return { ops };
}

/** what the ops did, in {bati}'s words (「テンポを速く・2番をカット」) */
export function tweakWhat(ops: SongTweakOp[]): string {
  const part = (p: SongPart) => ('cycle' in p ? `${p.cycle}番` : { intro: 'イントロ', verse: 'Aメロ', 'pre-chorus': 'サビ前', chorus: 'サビ', 'final-chorus': '大サビ', bridge: 'Cメロ', instrumental: '間奏', 'guitar-solo': 'ギターソロ', 'piano-solo': 'ピアノ間奏', build: 'ビルド', drop: 'ドロップ', outro: 'アウトロ' }[p.section]);
  return ops
    .map((o) => {
      switch (o.op) {
        case 'tempo':
          return o.to !== undefined ? (Math.abs(o.to - 1) < 0.001 ? '元の速さに' : `テンポを${o.to}倍に`) : o.factor > 1 ? 'テンポを速く' : 'テンポをゆっくり';
        case 'key':
          return o.semitones > 0 ? `キーを${o.semitones}つ上げ` : `キーを${-o.semitones}つ下げ`;
        case 'cut':
          return `${part(o.part)}をカット`;
        case 'repeat':
          return `${part(o.part)}をもう一回`;
        case 'length':
          return o.seconds > 0 ? `${Math.round(o.seconds)}秒に` : '短く';
        case 'fade':
          return o.in && o.out ? 'フェードイン・フェードアウト' : o.in ? 'フェードイン' : 'フェードアウト';
        case 'balance':
          return o.vocalDb !== undefined ? (o.vocalDb > 0 ? '歌を大きく' : '歌をひかえめ') : (o.bgmDb ?? 0) > 0 ? '演奏を大きく' : '演奏をひかえめ';
        case 'only':
          return o.stem === 'instrumental' ? 'カラオケに' : o.stem === 'vocals' ? '歌だけに' : '歌と演奏をもとどおり';
        case 'room':
          return o.amount > 0 ? '響きをつけて' : '響きを消して';
      }
    })
    .join('・');
}

// --- the ops so far + new ones → the ops from the original ----------------------------------------------------------

/** the state the ops add up to (what the renderer reads) */
export interface TweakPlan {
  tempo: number;
  semitones: number;
  cuts: SongPart[];
  repeats: SongPart[];
  maxSeconds: number | null;
  fadeIn: number;
  fadeOut: number;
  vocalDb: number;
  bgmDb: number;
  stem: 'both' | 'instrumental' | 'vocals';
  room: number;
}
const samePart = (a: SongPart, b: SongPart) => JSON.stringify(a) === JSON.stringify(b);
/**
 * R17 `base`: the tempo the song is delivered at over how it was sung (SONG_DEFAULT_TEMPO: 1.2) — every version is made
 * from the original at base × the tempo ops (「もっと速く」 from 1.2, 「元の速さで」 back to 1)
 */
export function tweakPlan(ops: SongTweakOp[], base = 1): TweakPlan {
  const p: TweakPlan = { tempo: base, semitones: 0, cuts: [], repeats: [], maxSeconds: null, fadeIn: 0, fadeOut: 0, vocalDb: 0, bgmDb: 0, stem: 'both', room: 0 };
  for (const o of ops) {
    if (o.op === 'tempo') p.tempo = Math.max(0.7, Math.min(1.5, o.to ?? p.tempo * o.factor));
    else if (o.op === 'key') p.semitones = Math.max(-6, Math.min(6, p.semitones + o.semitones));
    else if (o.op === 'cut') {
      if (!p.cuts.some((c) => samePart(c, o.part))) p.cuts.push(o.part);
      p.repeats = p.repeats.filter((r) => !samePart(r, o.part));
    } else if (o.op === 'repeat') p.repeats.push(o.part);
    else if (o.op === 'length') p.maxSeconds = o.seconds;
    else if (o.op === 'fade') {
      if (o.in !== undefined) p.fadeIn = o.in;
      if (o.out !== undefined) p.fadeOut = o.out;
    } else if (o.op === 'balance') {
      p.vocalDb = Math.max(-12, Math.min(12, p.vocalDb + (o.vocalDb ?? 0)));
      p.bgmDb = Math.max(-12, Math.min(12, p.bgmDb + (o.bgmDb ?? 0)));
    } else if (o.op === 'only') p.stem = o.stem;
    else if (o.op === 'room') p.room = o.amount;
  }
  return p;
}

// --- where the parts are in time --------------------------------------------------------------------------------------

/** one block's place in the original song (seconds): sung blocks from their lines' times */
export type BlockSpan = { key: string; section: LyricSection; cycle: number; start: number; end: number };

/**
 * the sung blocks in time, from the line times (SongPhrase.block / startBeat / beats at the song's bpm); a block runs from
 * a little before its first line to the start of the next block (its tail and any instrumental after it go with it — a
 * cut 2番 takes the bars after its chorus too, up to what comes next)
 */
export function blockSpans(phrases: Pick<SongPhrase, 'block' | 'startBeat' | 'beats'>[], bpm: number, seconds: number): BlockSpan[] {
  const spb = 60 / bpm;
  const byKey = new Map<string, { start: number; end: number }>();
  const order: string[] = [];
  for (const p of phrases) {
    if (!p.block) continue;
    const s = p.startBeat * spb;
    const e = (p.startBeat + p.beats) * spb;
    const b = byKey.get(p.block);
    if (!b) {
      byKey.set(p.block, { start: s, end: e });
      order.push(p.block);
    } else {
      b.start = Math.min(b.start, s);
      b.end = Math.max(b.end, e);
    }
  }
  let cycle = 1;
  let verses = 0;
  const lead = 0.35;
  return order.map((key, i) => {
    const section = key.split('#')[0] as LyricSection;
    if (section === 'verse' && ++verses > 1) cycle = verses;
    const b = byKey.get(key)!;
    const next = order[i + 1] ? byKey.get(order[i + 1])!.start - lead : Math.min(seconds, b.end + 2 * 4 * spb);
    return { key, section, cycle, start: Math.max(0, b.start - lead), end: Math.max(b.end, Math.min(seconds, next)) };
  });
}

/** the blocks a part means (2番: every block of cycle 2 but its bridge / final chorus; a section: all of them, or the n-th) */
export function partBlocks(spans: BlockSpan[], part: SongPart): BlockSpan[] {
  if ('cycle' in part) return spans.filter((s) => s.cycle === part.cycle && (s.section === 'verse' || s.section === 'pre-chorus' || s.section === 'chorus'));
  const all = spans.filter((s) => s.section === part.section);
  return part.n ? all.slice(part.n - 1, part.n) : all;
}

/** a stretch of the original kept, in order (a repeat is a stretch again) */
export type Segment = { start: number; end: number };

/**
 * the original's timeline after the cuts and repeats: the stretches kept, in order (a repeated part again before the
 * outro / the end). null when a part named is not in the song.
 */
export function tweakSegments(spans: BlockSpan[], seconds: number, plan: Pick<TweakPlan, 'cuts' | 'repeats'>): { segments: Segment[]; missing: boolean } {
  let missing = false;
  let cuts: Segment[] = [];
  for (const c of plan.cuts) {
    const bs = partBlocks(spans, c);
    if (!bs.length) {
      missing = true;
      continue;
    }
    // the blocks of a part side by side are cut as one stretch
    for (const b of bs) cuts.push({ start: b.start, end: b.end });
  }
  cuts = cuts.sort((a, b) => a.start - b.start).reduce<Segment[]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && c.start <= last.end + 0.05) last.end = Math.max(last.end, c.end);
    else acc.push({ ...c });
    return acc;
  }, []);
  let segs: Segment[] = [];
  let t = 0;
  for (const c of cuts) {
    if (c.start > t + 0.05) segs.push({ start: t, end: c.start });
    t = Math.max(t, c.end);
  }
  if (seconds > t + 0.05) segs.push({ start: t, end: seconds });
  for (const r of plan.repeats) {
    const bs = partBlocks(spans, r).filter((b) => !cuts.some((c) => b.start >= c.start - 0.01 && b.end <= c.end + 0.01));
    if (!bs.length) {
      missing = true;
      continue;
    }
    // the last of that part once more, before the outro (the bars after the last sung block)
    const b = bs[bs.length - 1];
    const lastSung = spans.filter((s) => !cuts.some((c) => s.start >= c.start - 0.01 && s.end <= c.end + 0.01)).pop();
    const at = lastSung ? lastSung.end : seconds;
    const before: Segment[] = [];
    const after: Segment[] = [];
    for (const s of segs) {
      if (s.end <= at + 0.01) before.push(s);
      else if (s.start >= at - 0.01) after.push(s);
      else {
        before.push({ start: s.start, end: at });
        after.push({ start: at, end: s.end });
      }
    }
    segs = [...before, { start: b.start, end: b.end }, ...after];
  }
  return { segments: segs.filter((s) => s.end - s.start > 0.2), missing };
}

/** the crossfade at each join (seconds) */
export const TWEAK_XFADE = 0.12;

/**
 * the lines in the new timeline: each kept line moved to where its stretch now is, a repeated part's lines again, then
 * the tempo; lines cut away are gone; past the length, gone
 */
export function tweakPhrases(phrases: SongPhrase[], bpm: number, segments: Segment[], plan: Pick<TweakPlan, 'tempo' | 'maxSeconds'>, seconds: number): { phrases: SongPhrase[]; seconds: number } {
  const spb = 60 / bpm;
  const out: SongPhrase[] = [];
  let at = 0;
  segments.forEach((seg, k) => {
    // a stretch after a join starts a crossfade earlier
    const base = at - (k > 0 ? TWEAK_XFADE : 0);
    for (const p of phrases) {
      const s = p.startBeat * spb;
      if (s < seg.start - 0.01 || s >= seg.end - 0.01) continue;
      const ns = (base + (s - seg.start)) / plan.tempo;
      out.push({ ...p, index: out.length, startBeat: Math.round((ns / spb) * 1000) / 1000, beats: Math.round((p.beats / plan.tempo) * 1000) / 1000, seconds: Math.round((p.seconds / plan.tempo) * 100) / 100 });
    }
    at = base + (seg.end - seg.start);
  });
  let total = Math.max(0, at) / plan.tempo;
  if (!segments.length) total = seconds / plan.tempo;
  if (plan.maxSeconds && plan.maxSeconds > 0 && plan.maxSeconds < total) total = plan.maxSeconds;
  return { phrases: out.filter((p) => p.startBeat * spb < total - 0.5), seconds: Math.round(total * 10) / 10 };
}

/** the lyrics after the cuts and repeats (what the card's lyric sheet shows) */
export function tweakLyrics(l: SongLyrics, spans: Pick<BlockSpan, 'key'>[] | null, plan: Pick<TweakPlan, 'cuts' | 'repeats'>): SongLyrics {
  const keys = lyricBlockKeys(l);
  let cycle = 1;
  let verses = 0;
  const cy = l.blocks.map((b) => {
    if (b.section === 'verse' && ++verses > 1) cycle = verses;
    return cycle;
  });
  const isIn = (i: number, p: SongPart) => {
    const b = l.blocks[i];
    if ('cycle' in p) return cy[i] === p.cycle && (b.section === 'verse' || b.section === 'pre-chorus' || b.section === 'chorus');
    if (b.section !== p.section) return false;
    if (!p.n) return true;
    return keys[i] === `${p.section}#${p.n}`;
  };
  void spans;
  const kept = l.blocks.map((b, i) => ({ b, i })).filter(({ i }) => !plan.cuts.some((c) => isIn(i, c)));
  let blocks = kept.map(({ b }) => b);
  for (const r of plan.repeats) {
    const hit = kept.filter(({ i }) => isIn(i, r)).pop();
    if (!hit) continue;
    const at = blocks[blocks.length - 1]?.section === 'outro' ? blocks.length - 1 : blocks.length;
    blocks = [...blocks.slice(0, at), hit.b, ...blocks.slice(at)];
  }
  return { ...l, blocks: blocks.length ? blocks : l.blocks };
}

/** a 短く with no number: three quarters of the song now (at least 20 s) */
export function resolveLength(ops: SongTweakOp[], seconds: number): SongTweakOp[] {
  return ops.map((o) => (o.op === 'length' && o.seconds < 0 ? { op: 'length', seconds: Math.max(20, Math.round(seconds * 0.75)) } : o));
}

/** at most this many versions are kept (the oldest after the original go first) */
export const SONG_TWEAK_VERSIONS = 12;
/** free changes an hour per member (each runs ffmpeg on our side) */
export const SONG_TWEAKS_PER_HOUR = 30;
