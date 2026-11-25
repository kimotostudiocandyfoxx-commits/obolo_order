import { z } from 'zod';
import { songGenreNamed, songStyleNamed, spellCorrection, spellKey, SpellTags, type SpellTag } from './spell';
import { songGenreOf } from './songGenres';

/**
 * R13 (client 2026-11-25): 「曲を作る時、普通のスペル以外に、メタタグ入りの歌詞を作るのが大事。メタタグもスペルにして、
 * きれいに見せて」. A song's spell has two parts:
 *   1. 曲調のスペル — the style talismans (genre, mood, tempo, instruments, voice, theme: spell.ts)
 *   2. スペル入りの歌詞 — {bati}'s Japanese lyrics, laid out in blocks, each opened by a metatag talisman (〔Aメロ〕〔サビ〕
 *      …) and maybe one or two performance talismans (〔ささやき〕〔ハモり〕…). Behind each label is the tag the song engine
 *      reads; the member never sees the English.
 *
 * The tags are only the ones our engine (ACE-Step 1.5, gpu/music/app.py) benefits from — its own lyric conventions
 * (ACE-Step-1.5 docs/en/Tutorial.md, "About Lyrics: The Temporal Script"): structure tags ([Intro] [Verse] [Pre-Chorus]
 * [Chorus] [Bridge] [Outro], dynamic / instrumental sections [Drop] [Instrumental] [Guitar Solo] [Piano Interlude]),
 * combined with at most a couple of modifiers by " - " ([Chorus - anthemic], [Bridge - whispered], [Outro - fade out]),
 * plus its vocal-control and energy tags. Its advice is kept: few modifiers per tag (stacking makes it sing the tag), and
 * the caption agrees with the lyric tags (a guitar solo tag → "guitar solo" in the caption too: lyricsCaption).
 * The sheet goes to the engine as written (lyricsSheet → SongReq.sheet); the sung lines also go as the engine's older
 * verse / chorus / bridge lines (lyricsSections), so a studio not yet redeployed still sings them.
 */

type SectionDef = { en: string; ja: string; re: RegExp; sung: boolean; engine: 'verse' | 'chorus' | 'bridge' | null; caption?: string };
/** the structure tags (the block's first talisman). `sung`: a block with lines; else an instrumental moment (no lines) */
export const LYRIC_SECTION_DEFS = {
  intro: { en: 'Intro', ja: 'はじまり', re: /はじまり|始まり|イントロ|前奏/, sung: false, engine: null },
  verse: { en: 'Verse', ja: 'Aメロ', re: /Aメロ|Ａメロ|エーメロ|1番の?(はじめ|最初)/, sung: true, engine: 'verse' },
  'pre-chorus': { en: 'Pre-Chorus', ja: 'サビ前', re: /サビ前|サビの前|Bメロ|Ｂメロ|プレコーラス/, sung: true, engine: 'verse' },
  'final-chorus': { en: 'Final Chorus', ja: '大サビ', re: /大サビ|ラストのサビ|最後のサビ|さいごのサビ|ラスサビ/, sung: true, engine: 'chorus' },
  chorus: { en: 'Chorus', ja: 'サビ', re: /サビ|コーラス(?!を重ね)/, sung: true, engine: 'chorus' },
  bridge: { en: 'Bridge', ja: 'Cメロ', re: /Cメロ|Ｃメロ|Dメロ|ブリッジ/, sung: true, engine: 'bridge' },
  instrumental: { en: 'Instrumental', ja: '間奏', re: /間奏|インスト/, sung: false, engine: null },
  'guitar-solo': { en: 'Guitar Solo', ja: 'ギターソロ', re: /ギターソロ|ギターの?ソロ/, sung: false, engine: null, caption: 'guitar solo' },
  'piano-solo': { en: 'Piano Interlude', ja: 'ピアノ間奏', re: /ピアノ間奏|ピアノの?ソロ|ピアノの間奏/, sung: false, engine: null, caption: 'piano interlude' },
  // R14: an electronic song's rise before its drop (psytrance, EDM …)
  build: { en: 'Build', ja: 'ビルド', re: /ビルドパート|ビルドの部分|ビルドを/, sung: false, engine: null, caption: 'build-up' },
  drop: { en: 'Drop', ja: 'ドロップ', re: /ドロップ/, sung: false, engine: null, caption: 'big drop' },
  outro: { en: 'Outro', ja: 'おわり', re: /おわり|終わり|アウトロ|エンディング|後奏/, sung: false, engine: null },
} as const satisfies Record<string, SectionDef>;
export type LyricSection = keyof typeof LYRIC_SECTION_DEFS;
export const LYRIC_SECTIONS = Object.keys(LYRIC_SECTION_DEFS) as [LyricSection, ...LyricSection[]];

type HintDef = { en: string; ja: string; re: RegExp; caption: string };
/** the performance / arrangement tags (a modifier on its block's structure tag: [Bridge - whispered]) */
export const LYRIC_HINT_DEFS = {
  whispered: { en: 'whispered', ja: 'ささやき', re: /ささやき|ささやいて|囁|ウィスパー/, caption: 'whispered vocals in parts' },
  harmonies: { en: 'harmonies', ja: 'ハモり', re: /ハモり|ハモリ|ハモって|ハモる|ハーモニー|コーラスを重ね/, caption: 'vocal harmonies' },
  building: { en: 'building energy', ja: '盛り上げ', re: /盛り上げ|盛りあげ|もりあげ|盛り上が|ビルドアップ|ビルド/, caption: 'building energy' },
  powerful: { en: 'powerful', ja: '力強く', re: /力強|力づよ|ちからづよ|パワフル|熱く歌/, caption: 'powerful vocals' },
  falsetto: { en: 'falsetto', ja: '裏声', re: /裏声|うらごえ|ファルセット/, caption: 'falsetto' },
  spoken: { en: 'spoken word', ja: '語り', re: /語り|かたり|セリフ|せりふ|ラップ/, caption: 'spoken word part' },
  call: { en: 'call and response', ja: 'かけあい', re: /かけあい|掛け合い|掛けあい|コール/, caption: 'call and response vocals' },
  euphoric: { en: 'euphoric', ja: 'きらきら', re: /きらきら|キラキラ|明るく|あかるく|晴れやか/, caption: 'euphoric' },
  melancholic: { en: 'melancholic', ja: 'せつなく', re: /せつなく|切なく|せつない|切ない|かなしく|悲しく/, caption: 'melancholic' },
  dreamy: { en: 'dreamy', ja: 'ゆめみたい', re: /ゆめみたい|夢みたい|夢のよう|ふわふわ|ドリーミー/, caption: 'dreamy' },
  quiet: { en: 'low energy', ja: 'しずかに', re: /しずかに|静かに|おだやかに|穏やかに|ひかえめ|控えめ/, caption: 'restrained' },
  fade: { en: 'fade out', ja: 'フェードアウト', re: /フェードアウト|フェイドアウト|だんだん小さく|消えるように/, caption: 'fade-out ending' },
} as const satisfies Record<string, HintDef>;
export type LyricHint = keyof typeof LYRIC_HINT_DEFS;
export const LYRIC_HINTS = Object.keys(LYRIC_HINT_DEFS) as [LyricHint, ...LyricHint[]];

/** a line the engine can sing in one breath (ACE-Step: about 6–10 syllables a line works best) */
export const LYRIC_LINE_MAX = 40;
export const LYRIC_LINES_MAX = 40;
export const LYRIC_BLOCKS_MAX = 16;
/** ACE-Step: "Don't stack too many tags" — one or two modifiers a block */
export const LYRIC_HINTS_PER_BLOCK = 2;

export const LyricBlock = z.object({
  section: z.enum(LYRIC_SECTIONS),
  hints: z.array(z.enum(LYRIC_HINTS)).max(LYRIC_HINTS_PER_BLOCK).default([]),
  lines: z.array(z.string().trim().min(1).max(LYRIC_LINE_MAX)).max(8).default([]),
});
export type LyricBlock = z.infer<typeof LyricBlock>;
export const SongLyrics = z
  .object({
    /** the song's name {bati} gave it (the card's title) */
    title: z.string().trim().max(40).optional(),
    blocks: z.array(LyricBlock).min(1).max(LYRIC_BLOCKS_MAX),
  })
  .refine((l) => l.blocks.some((b) => b.lines.length > 0), { message: 'no sung line' })
  .refine((l) => l.blocks.reduce((a, b) => a + b.lines.length, 0) <= LYRIC_LINES_MAX, { message: 'too many lines' });
export type SongLyrics = z.infer<typeof SongLyrics>;

/** POST /moon/lyrics: Bati's lyrics for the style spell (none yet), the lyrics changed by the words, or the member's own lyrics structured */
export const LyricsBody = z.object({
  /** the style talismans (曲調のスペル) the lyrics go with */
  tags: SpellTags,
  /** the request (a fresh song), the change (「サビをもっと明るく」), or the member's own words */
  said: z.string().trim().min(1).max(1200),
  /** the lyrics as they are now (an edit) */
  lyrics: SongLyrics.optional(),
});
export type LyricsBody = z.infer<typeof LyricsBody>;
export interface LyricsView {
  lyrics: SongLyrics;
  /** how it came: written by {bati}, the member's own words structured, changed, or a change not made */
  how: 'new' | 'own' | 'edit' | 'kept';
  /** {bati}'s gentle no: the words were a real song's lyrics (written anew in that mood instead), or cannot be sung */
  declined?: 'copy' | 'flagged';
}

// --- labels and the engine's sheet ---------------------------------------------------------------------------------

const S = LYRIC_SECTION_DEFS as Record<LyricSection, SectionDef>;
const H = LYRIC_HINT_DEFS as Record<LyricHint, HintDef>;
export const lyricSectionLabel = (s: LyricSection) => S[s].ja;
export const lyricHintLabel = (h: LyricHint) => H[h].ja;
export const lyricSectionSung = (s: LyricSection) => S[s].sung;

/** which 番 (cycle) each block is in: a verse after the first starts the next (2番); the bridge on is the last part */
function cycles(blocks: LyricBlock[]): number[] {
  let c = 1;
  let verses = 0;
  return blocks.map((b) => {
    if (b.section === 'verse' && ++verses > 1) c = verses;
    return c;
  });
}

/** the label a block's tag talisman shows: 〔Aメロ〕, 〔2番Aメロ〕, 〔サビ〕, 〔2番サビ〕 … */
export function lyricBlockLabels(l: Pick<SongLyrics, 'blocks'>): string[] {
  const cy = cycles(l.blocks);
  return l.blocks.map((b, i) => (cy[i] > 1 && (b.section === 'verse' || b.section === 'pre-chorus' || b.section === 'chorus') ? `${cy[i]}番${S[b.section].ja}` : S[b.section].ja));
}

/** a stable key per block (section + its count so far): a change keeps the keys of the blocks it did not touch */
export function lyricBlockKeys(l: Pick<SongLyrics, 'blocks'>): string[] {
  const n = new Map<string, number>();
  return l.blocks.map((b) => {
    const k = (n.get(b.section) ?? 0) + 1;
    n.set(b.section, k);
    return `${b.section}#${k}`;
  });
}

/**
 * the lyrics as ACE-Step reads them: each block's structure tag with its modifiers (`[Verse 2]`, `[Chorus - harmonies]`,
 * `[Outro - fade out]`), its lines under it, a blank line between blocks (its own "clear section separation")
 */
export function lyricsSheet(l: Pick<SongLyrics, 'blocks'>): string {
  const verses = l.blocks.filter((b) => b.section === 'verse').length;
  let v = 0;
  return l.blocks
    .map((b) => {
      const name = b.section === 'verse' && verses > 1 ? `${S.verse.en} ${++v}` : S[b.section].en;
      const head = `[${[name, ...b.hints.map((h) => H[h].en)].join(' - ')}]`;
      return [head, ...b.lines].join('\n');
    })
    .join('\n\n')
    .slice(0, 4000);
}

/** the words the caption gets from the lyric tags, so caption and lyrics tell the same story (ACE-Step: no conflicts) */
export function lyricsCaption(l: Pick<SongLyrics, 'blocks'>): string[] {
  const out: string[] = [];
  for (const b of l.blocks) {
    const c = S[b.section].caption;
    if (c && !out.includes(c)) out.push(c);
    for (const h of b.hints) if (!out.includes(H[h].caption)) out.push(H[h].caption);
  }
  return out;
}

/** the caption: the style spell's prompt with the lyric tags' words (≤ 500, the engine's limit) */
export function lyricsPrompt(stylePrompt: string, l: Pick<SongLyrics, 'blocks'> | undefined): string {
  const add = l ? lyricsCaption(l).filter((c) => !stylePrompt.toLowerCase().includes(c.toLowerCase())) : [];
  return [stylePrompt, ...add].filter(Boolean).join(', ').slice(0, 500);
}

/** the sung lines as the engine's older sections (verse / chorus / bridge, ≤ 8 lines each): FullSongBody.sections */
export function lyricsSections(l: Pick<SongLyrics, 'blocks'>): { name: 'verse' | 'chorus' | 'bridge'; lines: { text: string; beats: number }[] }[] {
  const out: { name: 'verse' | 'chorus' | 'bridge'; lines: { text: string; beats: number }[] }[] = [];
  for (const b of l.blocks) {
    const name = S[b.section].engine;
    if (!name || !b.lines.length) continue;
    const last = out[out.length - 1];
    if (last && last.name === name && last.lines.length + b.lines.length <= 8) last.lines.push(...b.lines.map((text) => ({ text, beats: 8 })));
    else out.push({ name, lines: b.lines.map((text) => ({ text, beats: 8 })) });
  }
  return out;
}

/** each sung line with the label of its block (the finished song keeps 〔サビ〕 by its lines) */
export function lyricsLines(l: Pick<SongLyrics, 'blocks'>): { label: string; text: string }[] {
  const labels = lyricBlockLabels(l);
  return l.blocks.flatMap((b, i) => b.lines.map((text) => ({ label: labels[i], text })));
}

/** the lyrics' fingerprint */
export function lyricsKey(l: Pick<SongLyrics, 'blocks'>): string {
  const s = l.blocks.map((b) => `${b.section}/${b.hints.join('+')}/${b.lines.join('|')}`).join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `L${l.blocks.length}-${h.toString(16).padStart(8, '0')}`;
}

/**
 * R13: what the yes of a song is tied to (MakeConfirm.spell) — the style talismans AND the structured lyrics: a change of
 * either is another spell (SPELL_CHANGED). Tags only (no lyrics: an older client, a spell from elsewhere): spellKey.
 */
export function songSpellKey(tags: SpellTag[] | undefined | null, lyrics?: Pick<SongLyrics, 'blocks'> | null): string | null {
  if (!tags?.length && !lyrics) return null;
  const t = tags?.length ? spellKey('song', tags) : 'song-0';
  return lyrics ? `${t}~${lyricsKey(lyrics)}` : t;
}

// --- reading lyrics: the model's answer, a sheet, the member's own words -------------------------------------------

const lower = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim();
/** a structure tag in English, our id or the Japanese label */
export function lyricSectionOf(word: string): LyricSection | null {
  const w = lower(word).replace(/\s*\d+$/, '');
  for (const [id, d] of Object.entries(S) as [LyricSection, SectionDef][]) if (w === id || w === lower(d.en) || word.trim() === d.ja) return id;
  if (/^(pre ?chorus|prechorus|build ?up|build)$/.test(w)) return 'pre-chorus';
  if (/^(hook|refrain)$/.test(w)) return 'chorus';
  if (/^(last chorus|outro chorus)$/.test(w)) return 'final-chorus';
  if (/^(inst|interlude|break|breakdown|solo)$/.test(w)) return 'instrumental';
  if (/^(piano solo|piano interlude)$/.test(w)) return 'piano-solo';
  if (/^(ending|end)$/.test(w)) return 'outro';
  const ja = word.trim().replace(/^\d+番/, '');
  for (const [id, d] of Object.entries(S) as [LyricSection, SectionDef][]) if (d.re.test(ja) && ja.length <= d.ja.length + 3) return id;
  return null;
}
/** a modifier in English, our id or the Japanese label (one the engine does not use: null, it is dropped) */
export function lyricHintOf(word: string): LyricHint | null {
  const w = lower(word);
  for (const [id, d] of Object.entries(H) as [LyricHint, HintDef][]) if (w === id || w === lower(d.en) || word.trim() === d.ja) return id;
  if (/^whisper/.test(w)) return 'whispered';
  if (/harmon|backing vocals?|stacked/.test(w)) return 'harmonies';
  if (/build|rising|crescendo/.test(w)) return 'building';
  if (/powerful|belting|anthemic|strong/.test(w)) return 'powerful';
  if (/spoken|rap/.test(w)) return 'spoken';
  if (/call/.test(w)) return 'call';
  if (/euphoric|bright|joyful|uplifting/.test(w)) return 'euphoric';
  if (/melanchol|sad|bittersweet/.test(w)) return 'melancholic';
  if (/dream/.test(w)) return 'dreamy';
  if (/low energy|soft|quiet|gentle|calm|intimate/.test(w)) return 'quiet';
  if (/fade/.test(w)) return 'fade';
  return null;
}

/** a sung line cleaned: no tags inside it, no quotes, at most LYRIC_LINE_MAX (a longer line is split at a space / 、) */
function cleanLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const t = raw
      .replace(/\[[^\]]*\]|〔[^〕]*〕/g, ' ')
      .replace(/^[ \t「『"'・\-–—*]+|[ \t」』"']+$/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (!t) continue;
    if ([...t].length <= LYRIC_LINE_MAX) {
      out.push(t);
      continue;
    }
    let rest = t;
    while ([...rest].length > LYRIC_LINE_MAX) {
      const head = [...rest].slice(0, LYRIC_LINE_MAX).join('');
      const cut = Math.max(head.lastIndexOf(' '), head.lastIndexOf('　'), head.lastIndexOf('、'));
      const at = cut > 8 ? cut + 1 : LYRIC_LINE_MAX;
      out.push([...rest].slice(0, at).join('').trim());
      rest = [...rest].slice(at).join('').trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * any lyrics-like answer → SongLyrics (or null): blocks of {tag | section, hints | modifiers, lines} in English, our ids
 * or Japanese; unknown modifiers are dropped (the engine would only try to sing them), unknown sections become verses;
 * an instrumental block keeps no lines; at most LYRIC_HINTS_PER_BLOCK, 8 lines a block, LYRIC_LINES_MAX in all
 */
export function lyricsNormalize(raw: unknown): SongLyrics | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { title?: unknown; blocks?: unknown; sheet?: unknown };
  if (typeof o.sheet === 'string' && !Array.isArray(o.blocks)) {
    const p = parseLyricsSheet(o.sheet);
    return p ? { ...p, ...(typeof o.title === 'string' && o.title.trim() ? { title: o.title.trim().slice(0, 40) } : {}) } : null;
  }
  if (!Array.isArray(o.blocks)) return null;
  const blocks: LyricBlock[] = [];
  let total = 0;
  for (const b of o.blocks as unknown[]) {
    if (!b || typeof b !== 'object') continue;
    const x = b as { tag?: unknown; section?: unknown; hints?: unknown; modifiers?: unknown; lines?: unknown };
    const tag = typeof x.section === 'string' ? x.section : typeof x.tag === 'string' ? x.tag : '';
    // "[Chorus - harmonies]" in one string
    const parts = tag.replace(/^[[〔\s]+|[\]〕\s]+$/g, '').split(/\s+-\s+|\s*・\s*/);
    const section = lyricSectionOf(parts[0] ?? '') ?? 'verse';
    const hintWords = [...parts.slice(1), ...(Array.isArray(x.hints) ? x.hints : []), ...(Array.isArray(x.modifiers) ? x.modifiers : [])].filter((h): h is string => typeof h === 'string');
    const hints = [...new Set(hintWords.map(lyricHintOf).filter((h): h is LyricHint => !!h))].slice(0, LYRIC_HINTS_PER_BLOCK);
    const lines = S[section].sung || section === 'outro' || section === 'intro' || section === 'build' ? cleanLines(Array.isArray(x.lines) ? x.lines.filter((l): l is string => typeof l === 'string') : typeof x.lines === 'string' ? x.lines.split('\n') : []).slice(0, 8) : [];
    const room = LYRIC_LINES_MAX - total;
    const kept = lines.slice(0, Math.max(0, room));
    if (S[section].sung && !kept.length) continue;
    total += kept.length;
    blocks.push({ section, hints, lines: kept });
    if (blocks.length >= LYRIC_BLOCKS_MAX) break;
  }
  const r = SongLyrics.safeParse({ ...(typeof o.title === 'string' && o.title.trim() ? { title: o.title.trim().slice(0, 40) } : {}), blocks });
  return r.success ? r.data : null;
}

/** a sheet with tags in brackets ([Chorus - harmonies] / 〔サビ〕) → SongLyrics; text before the first tag is a verse */
export function parseLyricsSheet(text: string): SongLyrics | null {
  const blocks: { tag: string; lines: string[] }[] = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const m = line.trim().match(/^[[〔【［]([^\]〕】］]{1,60})[\]〕】］]\s*(.*)$/);
    if (m) {
      blocks.push({ tag: m[1], lines: m[2] ? [m[2]] : [] });
      continue;
    }
    if (!line.trim()) continue;
    if (!blocks.length) blocks.push({ tag: 'Verse', lines: [] });
    blocks[blocks.length - 1].lines.push(line);
  }
  return lyricsNormalize({ blocks });
}

/**
 * the member's own words with no tags (「歌詞はこれで：…」) structured by rule (the model does it better; this is the
 * fallback): stanzas by blank lines (else every 4 lines); a stanza said twice is the chorus; else verse, chorus, verse,
 * chorus…; an intro before and an outro after
 */
export function lyricsStructure(text: string): SongLyrics | null {
  if (/[[〔【［]/.test(text)) {
    const p = parseLyricsSheet(text);
    if (p) return withEnds(p);
  }
  const rows = text.replace(/\r/g, '').split('\n').map((x) => x.trim());
  let stanzas: string[][] = [];
  let cur: string[] = [];
  for (const r of rows) {
    if (!r) {
      if (cur.length) stanzas.push(cur);
      cur = [];
    } else cur.push(r);
  }
  if (cur.length) stanzas.push(cur);
  if (stanzas.length === 1 && stanzas[0].length > 4) {
    const all = stanzas[0].length === 1 ? stanzas[0][0].split(/[、。,.\s　]+/).filter(Boolean) : stanzas[0];
    stanzas = [];
    for (let i = 0; i < all.length; i += 4) stanzas.push(all.slice(i, i + 4));
  } else if (stanzas.length === 1 && stanzas[0].length === 1) {
    const words = stanzas[0][0].split(/[、。,.！!？?\s　]+/).filter(Boolean);
    stanzas = [];
    for (let i = 0; i < words.length; i += 4) stanzas.push(words.slice(i, i + 4));
  }
  if (!stanzas.length) return null;
  const seen = new Map<string, number>();
  for (const s of stanzas) seen.set(s.join('|'), (seen.get(s.join('|')) ?? 0) + 1);
  const repeated = [...seen.entries()].find(([, n]) => n > 1)?.[0];
  const blocks = stanzas.map((s, i): { section: LyricSection; lines: string[] } => ({ section: repeated ? (s.join('|') === repeated ? 'chorus' : 'verse') : i % 2 ? 'chorus' : 'verse', lines: s }));
  const l = lyricsNormalize({ blocks });
  return l ? withEnds(l) : null;
}

/** an intro before and an outro after, when they are not there (a song starts and ends like a song: studio lab r04) */
export function withEnds(l: SongLyrics): SongLyrics {
  const blocks = [...l.blocks];
  if (blocks[0]?.section !== 'intro' && blocks.length < LYRIC_BLOCKS_MAX) blocks.unshift({ section: 'intro', hints: [], lines: [] });
  if (blocks[blocks.length - 1]?.section !== 'outro' && blocks.length < LYRIC_BLOCKS_MAX) blocks.push({ section: 'outro', hints: [], lines: [] });
  return { ...l, blocks };
}

// --- changing the lyrics by words: what can be done by rule ---------------------------------------------------------

const REMOVE = /外して|はずして|消して|けして|なくして|抜いて|ぬいて|取って|とって|いらない|やめて|なしで|なしに|なし$|取り消して/;
const ADD = /足して|たして|加えて|くわえて|入れて|いれて|つけて|付けて|追加|ほしい|欲しい|して$|にして|やって|ちょうだい|お願い/;
const OWN = /^(?:歌詞は|歌詞を)?(?:これ|こう|こちら|コレ)で(?:作って|おねがい|お願い)?[\s:：、。]*|^歌詞[\s:：]+|^歌詞は[「『]|^この歌詞で[\s:：、。]*/;

/** 「歌詞はこれで：…」 / 「この歌詞で：…」 — the member's own lyrics (the words after it), or null */
export function ownLyricsOf(said: string): string | null {
  const m = said.match(/(?:歌詞は(?:これ|こう|こちら)で|この歌詞で|歌詞[:：])[\s:：、。]*([\s\S]+)$/);
  if (m && m[1].trim().length >= 4) return m[1].replace(/^[「『]|[」』]$/g, '').trim();
  void OWN;
  return null;
}

/**
 * the words are about the lyrics (a lyric change), not the style talismans. R13 fix: with the lyrics as they are, 「〇〇を
 * △△に変えて」 whose 〇〇 is (close to) a phrase of them is about the lyrics too (「話のままでのところを靴のままでに」)
 */
export function isLyricsTalk(said: string, lyrics?: Pick<SongLyrics, 'blocks'> | null): boolean {
  if (ownLyricsOf(said)) return true;
  // R14 (client 2026-11-25: 「全然違うよ、サイケデリックトランスにして」 got new lyrics, not a new spell): words about the
  // genre / the sound, or a correction, are a change of the style spell — unless they name the lyrics themselves
  // (「歌詞もサイケっぽくして」)
  if (!/歌詞|かし|フレーズ/.test(said) && (songGenreNamed(said) || spellCorrection(said))) return false;
  if (spellCorrection(said) && songStyleNamed(said) && !/歌詞|かし/.test(said)) return false;
  const rep = lyrics ? replaceAsk(said) : null;
  if (rep && lyrics && lyricsFind(lyrics, rep.from)) return true;
  if (/歌詞|かし|フレーズ|[0-9０-９一二三]番|1番|2番|3番|番を/.test(said)) return true;
  if (Object.values(S).some((d) => d.re.test(said))) return true;
  // R13 fix: 「ラップ系にして」「EDMにして」 name the song's genre (the style talismans), not a part of the lyrics
  if (songGenreNamed(said)) return false;
  return Object.values(H).some((d) => d !== H.euphoric && d !== H.melancholic && d !== H.quiet && d !== H.dreamy && d.re.test(said));
}

export type LyricsEdit = { lyrics: SongLyrics; op: 'dropHint' | 'addHint' | 'dropBlock' | 'addBlock' | 'replace' };

/**
 * R13 fix (client 2026-11-25: 「話のままでのところを靴のままでにしてほしい」, meaning はだしのままで): 「〇〇を△△に（変えて）」
 * 「〇〇のところを△△にしてほしい」「歌詞の「〇〇」を「△△」に」 — the phrase and its replacement, or null. A section or a
 * performance tag on either side is not a phrase (「サビを明るい感じに」 is new words).
 */
export function replaceAsk(said: string): { from: string; to: string } | null {
  const t = said.trim().replace(/^歌詞(?:の中)?の/, '');
  const m = t.match(/^[「『“"]?([^「」『』“”"、。]{1,24}?)[」』”"]?(?:って(?:いう)?(?:所|ところ|とこ|部分)?|の(?:所|ところ|とこ|部分)|(?:所|ところ|とこ|部分))?(?:を|は)[、\s　]*[「『“"]?([^「」『』“”"]{1,30}?)[」』”"]?(?:に|へ|って)(?:して|変えて|かえて|変更して|直して|なおして|書き換えて|書きかえて|替えて)?(?:ほしい|欲しい|ください|くれる|くれない|ちょうだい|もらえる|お願い|おねがい)?(?:[？?。！!\s]|ね|な|よ|かな|です)*$/);
  if (!m) return null;
  const [, from, to] = m;
  const meta = (x: string) => Object.values(S).some((d) => d.re.test(x)) || Object.values(H).some((d) => d.re.test(x)) || /^(歌詞|曲|歌|テンポ|もっと)/.test(x);
  if ([...from].length < 2 || meta(from) || meta(to)) return null;
  return { from, to };
}

/** katakana → hiragana, full-width → half-width, no spaces (how a phrase sounds, roughly) */
const kana = (s: string) => s.normalize('NFKC').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const lev = (a: string[], b: string[]) => {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
};
const SPACE = /[\s　、。,.!！?？]/;
const KANJI = /\p{sc=Han}/u;

/**
 * where a phrase is in the lyrics: the words as written, else the closest stretch of a line (kana-folded edit distance,
 * at least 60% alike); a first / last kanji that does not match (話 for はだし: another reading, a voice-input slip) takes
 * the stretch to the edge of its word. null: nothing close enough.
 */
export function lyricsFind(l: Pick<SongLyrics, 'blocks'>, phrase: string): { text: string; score: number } | null {
  const p = phrase.replace(/\s|　/g, '');
  if (!p) return null;
  for (const b of l.blocks) for (const x of b.lines) if (x.includes(p)) return { text: p, score: 1 };
  const pk = [...kana(p)];
  // a short phrase is only found as written (「ピアノ」 is not 「あの」)
  if (pk.length < 4) return null;
  let best: { line: string; i: number; j: number; score: number; dl: number } | null = null;
  for (const b of l.blocks)
    for (const line of b.lines) {
      const cs = [...line];
      const ks = cs.map((c) => kana(c));
      for (let i = 0; i < cs.length; i++) {
        if (SPACE.test(cs[i])) continue;
        for (let n = Math.max(2, pk.length - 1); n <= pk.length + 3 && i + n <= cs.length; n++) {
          if (SPACE.test(cs[i + n - 1])) continue;
          const w = ks.slice(i, i + n).filter((c) => !SPACE.test(c));
          const dist = lev(w, pk);
          const score = 1 - dist / Math.max(w.length, pk.length);
          const dl = Math.abs(w.length - pk.length);
          if (!best || score > best.score || (score === best.score && dl < best.dl)) best = { line, i, j: i + n, score, dl };
        }
      }
    }
  if (!best || best.score < 0.6) return null;
  const cs = [...best.line];
  let { i, j } = best;
  // a kanji at the phrase's edge that is not in the line: the word around it is the one meant
  if (KANJI.test(pk[0]) && kana(cs[i]) !== pk[0]) for (let k = 0; k < 4 && i > 0 && !SPACE.test(cs[i - 1]); k++) i--;
  if (KANJI.test(pk[pk.length - 1]) && kana(cs[j - 1]) !== pk[pk.length - 1]) for (let k = 0; k < 4 && j < cs.length && !SPACE.test(cs[j]); k++) j++;
  return { text: cs.slice(i, j).join(''), score: best.score };
}

const replaceIn = (line: string, from: string, to: string) => line.split(from).join(to);

const sectionsNamed = (said: string): LyricSection[] => {
  const out: LyricSection[] = [];
  let rest = said;
  // longer names first (大サビ before サビ, サビ前 before サビ, ピアノ間奏 before 間奏)
  for (const id of ['final-chorus', 'pre-chorus', 'piano-solo', 'guitar-solo', 'intro', 'verse', 'chorus', 'bridge', 'instrumental', 'build', 'drop', 'outro'] as LyricSection[]) {
    if (S[id].re.test(rest)) {
      out.push(id);
      rest = rest.replace(new RegExp(S[id].re.source, 'g'), '、');
    }
  }
  return out;
};
const hintsNamed = (said: string): LyricHint[] => (Object.keys(H) as LyricHint[]).filter((h) => H[h].re.test(said));

/** where a modifier goes when no block is named: its natural place in a song */
const HOME: Record<LyricHint, LyricSection[]> = {
  whispered: ['bridge', 'verse'],
  harmonies: ['chorus', 'final-chorus'],
  building: ['pre-chorus', 'verse'],
  powerful: ['final-chorus', 'chorus'],
  falsetto: ['chorus', 'bridge'],
  spoken: ['bridge', 'verse'],
  call: ['chorus'],
  euphoric: ['chorus'],
  melancholic: ['bridge', 'verse'],
  dreamy: ['bridge', 'intro'],
  quiet: ['verse', 'bridge'],
  fade: ['outro'],
};

/** a block of an instrumental kind put where it belongs: an intro first, an outro last, a solo / 間奏 / drop after the first chorus */
function placeBlock(blocks: LyricBlock[], section: LyricSection): LyricBlock[] {
  const b: LyricBlock = { section, hints: [], lines: [] };
  if (section === 'intro') return [b, ...blocks];
  if (section === 'outro') return [...blocks, b];
  const firstChorus = blocks.findIndex((x) => x.section === 'chorus');
  const bridge = blocks.findIndex((x) => x.section === 'bridge');
  const at = bridge >= 0 ? bridge : firstChorus >= 0 ? firstChorus + 1 : Math.max(1, blocks.length - (blocks[blocks.length - 1]?.section === 'outro' ? 1 : 0));
  return [...blocks.slice(0, at), b, ...blocks.slice(at)];
}

/**
 * a change of the lyrics that needs no writing — done by rule, the same on the server and in the review demo:
 *  - 「歌詞の〇〇を△△に」: the words replaced where they are
 *  - 「ささやきを外して」「サビのハモりを外して」: the modifier off (everywhere, or in the blocks named)
 *  - 「間奏を外して」「イントロなしで」: an instrumental block off (a sung block is not taken off by rule)
 *  - 「サビにハモりを足して」「最後はフェードアウト」: a modifier on (the blocks named, else its natural place)
 *  - 「ギターソロを入れて」「間奏を足して」: an instrumental block put in its place
 * null: a change that needs new words (「サビをもっと明るく」「2番を足して」) — the model writes it.
 */
export function lyricsEdit(l: SongLyrics, said: string): LyricsEdit | null {
  const rep = replaceAsk(said);
  if (rep) {
    const hit = lyricsFind(l, rep.from);
    if (hit) {
      const blocks = l.blocks.map((b) => ({ ...b, lines: b.lines.map((x) => [...replaceIn(x, hit.text, rep.to)].slice(0, LYRIC_LINE_MAX).join('')) }));
      return { lyrics: { ...l, blocks }, op: 'replace' };
    }
    if (/歌詞|[「『“"]/.test(said)) return null;
  }
  const secs = sectionsNamed(said);
  const hints = hintsNamed(said);
  if (REMOVE.test(said)) {
    const target = said.split(REMOVE)[0];
    const th = hintsNamed(target);
    const ts = sectionsNamed(target);
    if (th.length) {
      const blocks = l.blocks.map((b) => (!ts.length || ts.includes(b.section) ? { ...b, hints: b.hints.filter((h) => !th.includes(h)) } : b));
      return lyricsKey({ blocks }) === lyricsKey(l) ? null : { lyrics: { ...l, blocks }, op: 'dropHint' };
    }
    const drop = ts.filter((s) => !S[s].sung);
    if (drop.length) {
      const blocks = l.blocks.filter((b) => !drop.includes(b.section));
      return blocks.length === l.blocks.length || !blocks.some((b) => b.lines.length) ? null : { lyrics: { ...l, blocks }, op: 'dropBlock' };
    }
    return null;
  }
  // a modifier on: only words that name one (「サビをもっと明るく」 is new words, not the euphoric tag)
  const onlyTag = hints.filter((h) => h !== 'euphoric' && h !== 'melancholic' && h !== 'quiet' && h !== 'dreamy');
  if (onlyTag.length && (ADD.test(said) || /で$|に$|[をに]$/.test(said.replace(/[。！!\s]+$/, '')) || said.length <= 14)) {
    let changed = false;
    let blocks = [...l.blocks];
    for (const h of onlyTag) {
      let where = secs.filter((s) => blocks.some((b) => b.section === s));
      if (!where.length) where = HOME[h].filter((s) => blocks.some((b) => b.section === s)).slice(0, 1);
      if (!where.length && h === 'fade') {
        blocks = placeBlock(blocks, 'outro');
        where = ['outro'];
      }
      if (!where.length) where = [blocks.find((b) => b.lines.length)!.section];
      // a modifier on a repeated block: all of them (the chorus is the chorus every time)
      blocks = blocks.map((b) => {
        if (!where.includes(b.section) || b.hints.includes(h)) return b;
        changed = true;
        const hs = [...b.hints, h];
        return { ...b, hints: hs.slice(-LYRIC_HINTS_PER_BLOCK) };
      });
    }
    return changed ? { lyrics: { ...l, blocks }, op: 'addHint' } : null;
  }
  const instrumental = secs.filter((s) => !S[s].sung);
  if (instrumental.length && (ADD.test(said) || said.length <= 12)) {
    let blocks = [...l.blocks];
    for (const s of instrumental) if (!blocks.some((b) => b.section === s) && blocks.length < LYRIC_BLOCKS_MAX) blocks = placeBlock(blocks, s);
    return blocks.length === l.blocks.length ? null : { lyrics: { ...l, blocks }, op: 'addBlock' };
  }
  return null;
}

/**
 * one more 番 (2番, 3番 …) by rule when the model cannot write one: the first cycle's blocks (verse, pre-chorus, chorus)
 * again, after the last chorus of the cycles (before the bridge / final chorus / outro); unchanged when there is no room
 */
export function lyricsSecondVerse(l: SongLyrics): SongLyrics {
  const firstVerse = l.blocks.findIndex((b) => b.section === 'verse');
  const firstChorus = l.blocks.findIndex((b) => b.section === 'chorus');
  if (firstVerse < 0 || firstChorus < firstVerse) return l;
  const cycle = l.blocks.slice(firstVerse, firstChorus + 1).filter((b) => b.section !== 'intro');
  const total = l.blocks.reduce((a, b) => a + b.lines.length, 0) + cycle.reduce((a, b) => a + b.lines.length, 0);
  if (total > LYRIC_LINES_MAX || l.blocks.length + cycle.length > LYRIC_BLOCKS_MAX) return l;
  let lastChorus = -1;
  l.blocks.forEach((b, i) => {
    if (b.section === 'chorus') lastChorus = i;
  });
  return { ...l, blocks: [...l.blocks.slice(0, lastChorus + 1), ...cycle, ...l.blocks.slice(lastChorus + 1)] };
}

/**
 * R17: a Cメロ (bridge) and a last chorus by rule when the model cannot write them (「Cメロも足して」「大サビも」): before
 * the outro; the bridge's lines new, the last chorus the chorus again. Unchanged when it has one or there is no room.
 */
export function lyricsWithBridge(l: SongLyrics): SongLyrics {
  if (l.blocks.some((b) => b.section === 'bridge' || b.section === 'final-chorus')) return l;
  const chorus = [...l.blocks].reverse().find((b) => b.section === 'chorus' && b.lines.length);
  if (!chorus) return l;
  const bridge = ['しずかな夜に　ひとりきり', 'そっと　名前を　よんでみる'];
  const total = l.blocks.reduce((a, b) => a + b.lines.length, 0) + bridge.length + chorus.lines.length;
  if (total > LYRIC_LINES_MAX || l.blocks.length + 2 > LYRIC_BLOCKS_MAX) return l;
  const at = l.blocks[l.blocks.length - 1]?.section === 'outro' ? l.blocks.length - 1 : l.blocks.length;
  const add: LyricBlock[] = [
    { section: 'bridge', hints: ['whispered'], lines: bridge },
    { section: 'final-chorus', hints: ['powerful'], lines: chorus.lines },
  ];
  return { ...l, blocks: [...l.blocks.slice(0, at), ...add, ...l.blocks.slice(at)] };
}

/** what a change did, for the sheet's motion: new blocks / tags drop in, changed lines glow, removed ones fall away */
export interface LyricsChange {
  newBlocks: string[];
  newHints: string[];
  changedLines: string[];
  goneBlocks: { key: string; section: LyricSection; hints: LyricHint[]; at: number }[];
  goneHints: { key: string; hint: LyricHint }[];
}
export function lyricsDiff(before: Pick<SongLyrics, 'blocks'> | null | undefined, after: Pick<SongLyrics, 'blocks'>): LyricsChange {
  const out: LyricsChange = { newBlocks: [], newHints: [], changedLines: [], goneBlocks: [], goneHints: [] };
  if (!before) return out;
  const bk = lyricBlockKeys(before);
  const ak = lyricBlockKeys(after);
  const was = new Map(bk.map((k, i) => [k, before.blocks[i]]));
  ak.forEach((k, i) => {
    const b = after.blocks[i];
    const o = was.get(k);
    if (!o) {
      out.newBlocks.push(k);
      return;
    }
    for (const h of b.hints) if (!o.hints.includes(h)) out.newHints.push(`${k}/${h}`);
    for (const h of o.hints) if (!b.hints.includes(h)) out.goneHints.push({ key: k, hint: h });
    b.lines.forEach((x, j) => {
      if (o.lines[j] !== x) out.changedLines.push(`${k}:${j}`);
    });
  });
  const now = new Set(ak);
  bk.forEach((k, i) => {
    if (now.has(k)) return;
    // shown where it was: before the next block that is still there
    const next = bk.slice(i + 1).find((x) => now.has(x));
    out.goneBlocks.push({ key: k, section: before.blocks[i].section, hints: before.blocks[i].hints, at: next ? ak.indexOf(next) : ak.length });
  });
  return out;
}

// --- {bati}'s lyrics when no model answers (and the review demo's) --------------------------------------------------

/** the theme words of the style spell (「夏」「海」), for the lyrics' own words */
const aboutOf = (tags: SpellTag[]) => tags.filter((t) => t.group === 'theme').map((t) => t.ja);

/**
 * R17 (client 2026-11-25: 「バティは1番だけ書く。2番・Cメロ・大サビは頼まれた時だけ」): what more than one verse the words
 * or the spell ask for — a 2番 (「2番も作って」「フルで」「長め」「2分」…), a Cメロ and a last chorus (「Cメロも」「大サビ」
 * 「フルで」「3分」…). Nothing asked: one verse, about a minute.
 */
export function lyricsAsked(said: string | null | undefined, tags: SpellTag[] = []): { second: boolean; bridge: boolean } {
  const s = (said ?? '').normalize('NFKC');
  const len = tags.find((t) => t.group === 'length');
  const lenSec = len ? (/3分|3 minutes|フル|full/i.test(`${len.ja} ${len.en}`) ? 180 : /2分|2 minutes/i.test(`${len.ja} ${len.en}`) ? 120 : /1分半|90/.test(`${len.ja} ${len.en}`) ? 90 : 0) : 0;
  const full = /フルで|フルコーラス|フルサイズ|フルバージョン|フルの曲|ぜんぶ入り|全部入り/.test(s) || lenSec >= 180;
  const second = full || lenSec >= 120 || /[2-4二三四]番|二番目|セカンド/.test(s);
  const bridge = full || /Cメロ|cメロ|Dメロ|ブリッジ|大サビ|ラスサビ|最後のサビ|さいごのサビ/.test(s);
  return { second, bridge };
}

/**
 * original lyrics by rule from the style spell (the model failing must not stop the song; the review demo's lyrics).
 * R17: one verse by default — intro → verse → pre-chorus (盛り上げ) → chorus (ハモり) → outro (フェードアウト), about a
 * minute; a 2番 (verse, pre-chorus, chorus again) and a bridge (ささやき) + final chorus only when `said` / the spell asks
 * for them (lyricsAsked). A mostly instrumental genre keeps its own sparse build / drop shape.
 */
export function lyricsFallback(tags: SpellTag[], said?: string | null): SongLyrics {
  const about = aboutOf(tags);
  const a = about[0] ?? 'きみ';
  const b = about[1] ?? '空';
  // R14: a mostly instrumental genre (psytrance, techno, ambient …) — a few repeated, hypnotic phrases between the
  // instrumental parts, not a story in verses
  const genre = songGenreOf(tags.find((t) => t.group === 'genre'));
  const how = tags.some((t) => t.group === 'voice' && t.ja === '歌なし') ? 'instrumental' : (genre?.lyrics ?? 'full');
  if (how !== 'full') {
    const mantra = how === 'instrumental' ? ['ひかりの中へ'] : ['ひかりの中へ', 'ひかりの中へ', 'とけていく'];
    return {
      title: `${a}のうた`.slice(0, 40),
      blocks: [
        { section: 'intro', hints: [], lines: [] },
        { section: 'build', hints: ['building'], lines: mantra },
        { section: 'drop', hints: [], lines: [] },
        { section: 'instrumental', hints: [], lines: [] },
        ...(how === 'sparse' ? [{ section: 'chorus' as const, hints: ['dreamy' as const], lines: [`${a}の　むこうへ`, 'もっと　ふかく', `${a}の　むこうへ`] }] : []),
        { section: 'build', hints: ['building'], lines: how === 'sparse' ? ['ひとつになる', 'ひとつになる'] : [] },
        { section: 'drop', hints: [], lines: [] },
        { section: 'outro', hints: ['fade'], lines: [] },
      ],
    };
  }
  const sad = tags.some((t) => t.group === 'mood' && /mellow|bittersweet|calm|sad|melanchol/i.test(t.en));
  const verse = sad ? [`しずかな${a}に　ひとり立って`, 'とおい日の声を　思い出す', 'ことばにできない　気持ちだけ', `${b}に　そっと　あずけてみる`] : [`まぶしい${a}の　においがして`, 'はだしのままで　かけだした', 'きのうの涙も　風がさらって', 'きょうのわたしに　会いにいく'];
  const pre = sad ? ['胸のおくで　ゆれる灯り', 'まだ　消えないで'] : ['胸のおくで　なにかが鳴る', 'もうすぐ　とどきそう'];
  const chorus = sad ? [`${a}の　うたを　うたうよ`, `${b}の　むこうの　きみまで`, 'なみだも　いつか　ひかりになる', 'わすれないで　ずっと'] : [`ひかれ　ひかれ　${a}のうた`, `${b}まで　とどけ　この声`, 'ふたりで　見つけた　あの光', 'わすれない　ずっと'];
  const bridge = sad ? ['夜があけたら', 'もう一度　はじめよう'] : ['しずかな夜に　ひとりきり', 'そっと　名前を　よんでみる'];
  const verse2 = sad ? ['夕やけの道　ならんだ影', 'ことばはいらない　わらいあう', 'ちいさな星が　ひとつ光って', 'あしたへ　つづいてく'] : ['あの日の約束　ポケットに', 'つよがりなんて　もういらない', 'ほどけた靴ひも　むすびなおして', 'もういちど　前を向く'];
  const more = lyricsAsked(said, tags);
  return {
    title: `${a}のうた`.slice(0, 40),
    blocks: [
      { section: 'intro', hints: [], lines: [] },
      { section: 'verse', hints: [], lines: verse },
      { section: 'pre-chorus', hints: ['building'], lines: pre },
      { section: 'chorus', hints: ['harmonies'], lines: chorus },
      ...(more.second
        ? [
            { section: 'verse' as const, hints: [], lines: verse2 },
            { section: 'pre-chorus' as const, hints: ['building' as const], lines: pre },
            { section: 'chorus' as const, hints: ['harmonies' as const], lines: chorus },
          ]
        : []),
      ...(more.bridge
        ? [
            { section: 'bridge' as const, hints: ['whispered' as const], lines: bridge },
            { section: 'final-chorus' as const, hints: ['powerful' as const], lines: chorus },
          ]
        : []),
      { section: 'outro', hints: ['fade'], lines: [] },
    ],
  };
}

/** the review demo's stand-in for the model's lyric changes (「サビをもっと明るく」「2番を足して」) */
export function lyricsDemoEdit(l: SongLyrics, said: string): SongLyrics | null {
  // R17: 「Cメロも足して」「大サビもほしい」 — a bridge and a last chorus (with a 2番 too when both are asked)
  if (/Cメロ|Ｃメロ|ブリッジ|大サビ|ラスサビ/.test(said) && /足|たし|追加|入れ|ほしい|欲しい|つく|作|も$|もお願い/.test(said)) {
    const withTwo = /[2２二]番/.test(said) ? (lyricsDemoEdit(l, '2番を足して') ?? l) : l;
    const more = lyricsWithBridge(withTwo);
    return more === l ? null : more;
  }
  if (/[0-9０-９二三2-3]番/.test(said) && /足|たし|追加|入れ|ほしい|欲しい|つく|作/.test(said)) {
    const more = lyricsSecondVerse(l);
    if (more === l) return null;
    const n = more.blocks.filter((b) => b.section === 'verse').length;
    let v = 0;
    const next = n === 2 ? ['あの日の約束　ポケットに', 'つよがりなんて　もういらない', 'ほどけた靴ひも　むすびなおして', 'もういちど　前を向く'] : ['夕やけの道　ならんだ影', 'ことばはいらない　わらいあう', 'ちいさな星が　ひとつ光って', 'あしたへ　つづいてく'];
    return { ...more, blocks: more.blocks.map((b) => (b.section === 'verse' && ++v === n ? { ...b, lines: next.slice(0, Math.max(2, b.lines.length)) } : b)) };
  }
  const secs = sectionsNamed(said);
  const bright = /明る|あかる|元気|楽し|たのし|ハッピー|晴れ/.test(said);
  const dark = /暗く|くらく|切な|せつな|悲し|かなし|しっとり/.test(said);
  // R13 fix: 「歌詞を変えて」「サビを変えて」「Aメロを書き直して」 — new lines for the blocks named (the lyrics: verse and chorus)
  if (!bright && !dark && /変えて|かえて|変更|書き直|かきなお|書きかえ|書き換え|別の|べつの|ちがう|違う|新しく|あたらしく/.test(said) && (secs.length || /歌詞|かし/.test(said))) {
    const where = secs.length ? secs : (['verse', 'chorus', 'final-chorus'] as LyricSection[]);
    const ALT: Partial<Record<LyricSection, string[]>> = {
      verse: ['ひかりの粒が　まどをたたく', 'ねぼけたままで　くつをはいた', 'しらない道を　えらんでみる', 'きょうのわたしを　ためしてみる'],
      'pre-chorus': ['風のむこうで　だれかがよぶ', 'もうすぐ　なにかがはじまる'],
      chorus: ['とどけ　とどけ　空のうた', '波をこえて　この声', 'ふたりで　えがいた　あの虹', 'きえないで　ずっと'],
      'final-chorus': ['とどけ　とどけ　空のうた', '波をこえて　この声', 'ふたりで　えがいた　あの虹', 'きえないで　ずっと'],
      bridge: ['しずかな夜に　ひとつ灯り', 'ゆっくり　あしたを　まっている'],
    };
    let changed = false;
    const blocks = l.blocks.map((b) => {
      const rows = ALT[b.section];
      if (!where.includes(b.section) || !b.lines.length || !rows) return b;
      const lines = b.lines.map((x, i) => rows[i % rows.length] ?? x);
      if (lines.join() === b.lines.join()) return b;
      changed = true;
      return { ...b, lines };
    });
    return changed ? { ...l, blocks } : null;
  }
  if (!bright && !dark) return null;
  const where = secs.length ? secs : (['chorus', 'final-chorus'] as LyricSection[]);
  const B = ['はじけて　はじけて　夏のうた', '笑顔で　とびこめ　青い空', 'ふたりで　つかんだ　太陽を', 'はなさない　ずっと'];
  const D = ['ほどけて　ほどけて　夜のうた', '涙で　にじんだ　青い空', 'ふたりで　さがした　あの星を', 'わすれない　ずっと'];
  const rows = bright ? B : D;
  const hint: LyricHint = bright ? 'euphoric' : 'melancholic';
  let changed = false;
  const blocks = l.blocks.map((b) => {
    if (!where.includes(b.section) || !b.lines.length) return b;
    changed = true;
    const hs = b.hints.includes(hint) ? b.hints : [...b.hints.filter((h) => h !== (bright ? 'melancholic' : 'euphoric')), hint].slice(-LYRIC_HINTS_PER_BLOCK);
    return { ...b, hints: hs, lines: b.lines.map((x, i) => rows[i % rows.length] ?? x) };
  });
  return changed ? { ...l, blocks } : null;
}
