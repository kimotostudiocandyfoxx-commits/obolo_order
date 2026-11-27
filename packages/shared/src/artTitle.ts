import { z } from 'zod';
import type { BatiVariantSet } from './batiVariants';
import { SpellTag, type SpellTag as Tag } from './spell';

/**
 * Story session 2026-11-25: an art work has a title. When a picture is painted in the Moon atelier {bati} proposes ONE
 * title from its spell — POST /moon/art-title, the small writer a song's name comes from (LYRICS_LLM, booked like the
 * lyrics: a free feature's small cost) — and the member keeps it or changes it in words, as a song's title is changed in
 * the talk (no buttons): 「タイトルは〇〇にして」 sets it; 「ほかのタイトルにして」 asks {bati} for another. Kept on the
 * Jupiter root (and the posts flown from it); Jupiter's hanging scroll shows it over the art (the first line of the
 * words only when a work has none).
 */
export const ART_TITLE_MAX = 24;
/** the writer is asked for a short one (the scroll shows it big over the art) */
export const ART_TITLE_ASK_MAX = 12;

/** POST /moon/art-title: one title for a picture's spell (`said`: what was asked; `before`: the title now, never again) */
export const ArtTitleBody = z.object({
  tags: z.array(SpellTag).max(16).default([]),
  said: z.string().trim().max(300).default(''),
  before: z.string().trim().max(ART_TITLE_MAX).optional(),
});
export type ArtTitleBody = z.infer<typeof ArtTitleBody>;
export interface ArtTitleView {
  title: string;
  /** the writer's, or by rule (the writer failed / slow / not usable) */
  how: 'writer' | 'rule';
}

/** a title as kept: one line, no brackets or quotes around it, at most ART_TITLE_MAX */
export function cleanArtTitle(t: string | null | undefined): string {
  return (t ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .replace(/^[「『"'“]+|[」』"'”]+$/g, '')
    .replace(/(の絵|のアート|を描いて|描いて)$/, '')
    .trim()
    .slice(0, ART_TITLE_MAX);
}

const FIRST = (tags: readonly Tag[], groups: string[]) => tags.find((t) => groups.includes(t.group))?.ja;

/** {bati}'s title by rule (no writer): 〈光や色〉の〈もの〉 from the spell, else the words asked, else 「むだい」 */
export function artTitleFallback(tags: readonly Tag[] = [], said = ''): string {
  const theme = FIRST(tags, ['theme', 'world', 'hero', 'composition']);
  const tone = FIRST(tags, ['light', 'color', 'mood']);
  if (theme && tone && tone !== theme) return cleanArtTitle(`${tone}の${theme}`).slice(0, ART_TITLE_ASK_MAX);
  if (theme) return cleanArtTitle(theme);
  const words = cleanArtTitle(said.replace(/[。！？!?、].*$/s, '').replace(/(を|の)?(絵|画像|イラスト|アート)(を|で)?(描いて|かいて|作って|つくって|ください|お願い|おねがい)?$/, ''));
  if (words) return words.slice(0, ART_TITLE_ASK_MAX);
  const any = tags.find((t) => t.group !== 'style')?.ja;
  return any ? cleanArtTitle(any) : 'むだい';
}

/** story 2026-11-27: a song's title as kept (one line, no quotes around it, at most 40 — the song's own limit) */
export const SONG_TITLE_MAX = 40;
export function cleanSongTitle(t: string | null | undefined): string {
  return (t ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .replace(/^[「『"'“]+|[」』"'”]+$/g, '')
    .trim()
    .slice(0, SONG_TITLE_MAX);
}

/** what words to {bati} about a made picture's title mean: a new title said, another one asked for, or nothing about it */
export type ArtTitleTalk = { to: string } | { again: true } | null;
const TITLE_WORD = '(?:タイトル|題名|だいめい|絵の名前|作品の名前|アートの名前)';
const SET_A = new RegExp(`${TITLE_WORD}\\s*(?:は|を|も)?\\s*[「『"]?(.+?)[」』"]?\\s*(?:に|で|が)\\s*(?:して|する|変えて|かえて|しよう|お願い|おねがい|いい|決めた|きめた)?\\s*(?:ください|ね|よ|な)?[。！!]*$`);
const SET_B = new RegExp(`^[「『"]?(.+?)[」』"]?\\s*(?:って|という|っていう)\\s*${TITLE_WORD}\\s*(?:に|で)`);
const AGAIN = new RegExp(`(?:ほかの|他の|別の|べつの|ちがう|違う|新しい|あたらしい)\\s*${TITLE_WORD}|${TITLE_WORD}\\s*(?:を|も)?\\s*(?:変えて|かえて|考えて|かんがえて|考え直して|ちがうの|違うの|別のに|べつのに)`);
const VAGUE = /^(?:ほかの|他の|別の|べつの|ちがう|違う|新しい|あたらしい|なにか|何か|いい感じ|いいかんじ|もっと.*)$/;

export function artTitleTalk(said: string): ArtTitleTalk {
  const s = said.trim();
  if (!new RegExp(TITLE_WORD).test(s)) return null;
  const m = SET_A.exec(s) ?? SET_B.exec(s);
  const to = cleanArtTitle(m?.[1]);
  if (to && !VAGUE.test(to) && !new RegExp(TITLE_WORD).test(to)) return { to };
  return AGAIN.test(s) ? { again: true } : null;
}

/**
 * story 2026-11-27: the same words about a made SONG's title (「タイトルは〇〇にして」「〇〇ってタイトルにして」, and the
 * song's own words 曲名 / 曲の名前 / 歌の名前) — a new title said, or nothing about it. (Another title by {bati} is not
 * asked for a song: its title came with its lyrics.) `named`: the words say 曲 / 歌, so they mean the song and not a picture.
 */
const SONG_WORD = '(?:曲名|曲のタイトル|曲の名前|歌の名前|うたの名前|歌のタイトル)';
const SONG_SET_A = new RegExp(`${SONG_WORD}\\s*(?:は|を|も)?\\s*[「『"]?(.+?)[」』"]?\\s*(?:に|で|が)\\s*(?:して|する|変えて|かえて|しよう|お願い|おねがい|いい|決めた|きめた)?\\s*(?:ください|ね|よ|な)?[。！!]*$`);
const SONG_SET_B = new RegExp(`^[「『"]?(.+?)[」』"]?\\s*(?:って|という|っていう)\\s*${SONG_WORD}\\s*(?:に|で)`);
export function songTitleTalk(said: string): { to: string; named: boolean } | null {
  const s = said.trim();
  if (new RegExp(SONG_WORD).test(s)) {
    const m = SONG_SET_A.exec(s) ?? SONG_SET_B.exec(s);
    const to = cleanSongTitle(m?.[1]);
    return to && !VAGUE.test(to) && !new RegExp(SONG_WORD).test(to) ? { to, named: true } : null;
  }
  if (/絵|アート|作品/.test(s)) return null;
  const t = artTitleTalk(s);
  if (!t || !('to' in t)) return null;
  const m = SET_A.exec(s) ?? SET_B.exec(s);
  const to = cleanSongTitle(m?.[1]);
  return to ? { to, named: false } : null;
}

// ───────────────────────────── {bati}'s lines (PROVISIONAL; the story chat checks them) ─────────────────────────────

export const ART_TITLE_LINES = {
  /** the picture is made: the one title proposed (no buttons; words change it) */
  propose: 'タイトルは「{title}」にしてみたよ。ちがう名前がよければ、言ってね。',
  /** 「タイトルは〇〇にして」: set */
  changed: 'タイトルを「{title}」にしたよ！',
  /** 「ほかのタイトルにして」: {bati}'s next proposal */
  again: 'じゃあ、「{title}」はどう？',
  /** a title that cannot be used (moderation) */
  flagged: 'その言葉は、タイトルにできないんだ。ほかの言葉にしてみよう。',
  /** the change could not be kept */
  failed: 'ごめん、タイトルをうまく変えられなかった。もう一回、言ってみて。',
} as const;
export const ART_TITLE_LINE_TEXTS: string[] = Object.values(ART_TITLE_LINES);

const v = (teinei: string, kansai: string, cool: string, mellow: string, amae: string, gal: string, galfuwa: string, galane: string, galcool: string, galkansai: string): BatiVariantSet => ({ teinei, kansai, cool, mellow, amae, gal, galfuwa, galane, galcool, galkansai });
const L = ART_TITLE_LINES;

/** the other styles (PROVISIONAL, P-BATI-VARIANTS): the sentences stay; the style shows in the endings of about half of them */
export const ART_TITLE_VARIANTS: Record<string, BatiVariantSet> = {
  [L.propose]: v(
    'タイトルは「{title}」にしてみマシタ。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみたで。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみた。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみたよぉ。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみたよ。ちがう名前がよければ、言ってほしいな。',
    'タイトル、「{title}」にしてみたじゃん。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみたよ〜。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみたよ。ちがう名前がよければ、言いな。',
    'タイトルは「{title}」にしてみた。ちがう名前がよければ、言ってね。',
    'タイトルは「{title}」にしてみたわ。ちがう名前がよければ、言ってね。',
  ),
  [L.changed]: v(
    'タイトルを「{title}」にしマシタ！',
    'タイトルを「{title}」にしたで！',
    'タイトルを「{title}」にした。',
    'タイトルを「{title}」にしたよ！',
    'タイトルを「{title}」にしたよ！',
    'タイトル、「{title}」にしたじゃん！',
    'タイトルを「{title}」にしたよ〜！',
    'タイトルを「{title}」にしたよ！',
    'タイトルを「{title}」にしたよ！',
    'タイトルを「{title}」にしたわ！',
  ),
  [L.again]: v(
    'じゃあ、「{title}」はどうデスか？',
    'ほな、「{title}」はどう？',
    'じゃあ、「{title}」はどうだ？',
    'じゃあ、「{title}」はどう？',
    'じゃあ、「{title}」はどうかな？',
    'じゃあ、「{title}」とかどう？',
    'じゃあ、「{title}」はどう？',
    'じゃあ、「{title}」はどう？',
    'じゃあ、「{title}」はどう？',
    'ほな、「{title}」はどう？',
  ),
  [L.flagged]: v(
    'その言葉は、タイトルにできないんデス。ほかの言葉にしてみよう。',
    'その言葉は、タイトルにできへんねん。ほかの言葉にしてみよう。',
    'その言葉は、タイトルにできない。ほかの言葉にしてみよう。',
    'その言葉は、タイトルにできないんだ。ほかの言葉にしてみようねぇ。',
    'その言葉は、タイトルにできないんだ。ほかの言葉にしてみよう。',
    'その言葉は、タイトルにできないんだよね。ほかの言葉にしてみよう。',
    'その言葉は、タイトルにできないんだ。ほかの言葉にしてみよ〜。',
    'その言葉は、タイトルにできないんだ。ほかの言葉にしてみな。',
    'その言葉は、タイトルにできない。ほかの言葉にしてみよう。',
    'その言葉は、タイトルにできへんのよ。ほかの言葉にしてみよう。',
  ),
  [L.failed]: v(
    'ごめん、タイトルをうまく変えられマセンデシタ。もう一回、言ってみて。',
    'ごめん、タイトルをうまく変えられへんかった。もう一回、言ってみて。',
    'ごめん、タイトルをうまく変えられなかった。もう一回、言ってみて。',
    'ごめんねぇ、タイトルをうまく変えられなかった。もう一回、言ってみて。',
    'ごめん、タイトルをうまく変えられなかった。もう一回、言ってくれる？',
    'ごめん、タイトルをうまく変えられなかったじゃん。もう一回、言ってみて。',
    'ごめん、タイトルをうまく変えられなかった〜。もう一回、言ってみて。',
    'ごめん、タイトルをうまく変えられなかった。もう一回、言ってみな。',
    'ごめん、タイトルをうまく変えられなかった。もう一回、言ってみて。',
    'ごめん、タイトルをうまく変えられへんかったわ。もう一回、言ってみて。',
  ),
};
