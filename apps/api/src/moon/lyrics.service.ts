import { Inject, Injectable, Logger } from '@nestjs/common';
import { lyricsRequest, lyricsSystem, moderateText, parseLyricsAnswer, type LlmProvider, type LyricsAsk } from '@obolo/ai';
import { lyricsEdit, lyricsFallback, lyricsSecondVerse, lyricsStructure, lyricsWithBridge, ownLyricsOf, withEnds, type LyricsBody, type LyricsView, type SongLyrics } from '@obolo/shared';
import { LLM, LYRICS_LLM } from '../infra/tokens';

const sung = (l: SongLyrics) => l.blocks.flatMap((b) => b.lines).join('\n');
const SECOND = /([2-4２-４二三四]番|二番目|セカンド)/;
const MORE = /足|たし|追加|入れ|いれ|ほしい|欲しい|作|つく|書いて|かいて/;
const BRIDGE = /Cメロ|Ｃメロ|ブリッジ|大サビ|ラスサビ/;

/**
 * R13 (client 2026-11-25): POST /moon/lyrics — {bati}'s スペル入りの歌詞 for a song's style spell: Japanese lyrics in blocks,
 * each with its metatag talismans (@obolo/shared lyrics.ts). Three asks:
 *  - fresh: the request + the style talismans → the writer (LYRICS_LLM) writes them
 *  - a change (`lyrics` given): what can be done by rule is (lyricsEdit: tags on / off, an instrumental block in / out,
 *    「歌詞の〇〇を△△に」); new words (「サビをもっと明るく」「2番を足して」) are the writer's, with the lyrics as context
 *  - 「歌詞はこれで：…」: the member's own words structured with tags (the writer; else by rule)
 * Original lyrics only: the writer's "copy" (pasted lyrics of a real song) → new lyrics in that mood, and {bati} says so
 * (`declined: 'copy'`). Words that cannot be sung (moderation) → nothing written from them (`declined: 'flagged'`).
 * The writer failing is no failure: a fresh song gets {bati}'s lyrics by rule, a change keeps the lyrics (`how: 'kept'`).
 */
@Injectable()
export class LyricsService {
  private readonly log = new Logger('Lyrics');
  constructor(
    @Inject(LYRICS_LLM) private readonly writer: LlmProvider,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  async lyrics(b: LyricsBody): Promise<LyricsView> {
    const own = ownLyricsOf(b.said);
    const words = await moderateText(b.said, own ? this.llm : undefined);
    if (words.flagged) return b.lyrics ? { lyrics: b.lyrics, how: 'kept', declined: 'flagged' } : { lyrics: lyricsFallback(b.tags, b.said), how: 'new', declined: 'flagged' };
    if (b.lyrics && !own) return this.edit(b.lyrics, b);
    if (own) {
      const r = await this.write({ mode: 'own', said: own, tags: b.tags });
      if (r?.copy) return { lyrics: r.lyrics ?? lyricsFallback(b.tags), how: 'new', declined: 'copy' };
      return { lyrics: r?.lyrics ? withEnds(r.lyrics) : (lyricsStructure(own) ?? lyricsFallback(b.tags)), how: 'own' };
    }
    const r = await this.write({ mode: 'new', said: b.said, tags: b.tags });
    // R17: one verse unless the words ask for a 2番 / Cメロ / a longer song (the rule's lyrics too)
    return { lyrics: r?.lyrics && !r.copy ? r.lyrics : lyricsFallback(b.tags, b.said), how: 'new' };
  }

  private async edit(now: SongLyrics, b: LyricsBody): Promise<LyricsView> {
    const local = lyricsEdit(now, b.said);
    if (local) return { lyrics: { ...local.lyrics, title: now.title }, how: 'edit' };
    const r = await this.write({ mode: 'edit', said: b.said, tags: b.tags, lyrics: now });
    if (r?.lyrics && !r.copy) return { lyrics: { ...r.lyrics, title: r.lyrics.title ?? now.title }, how: 'edit' };
    // 2番 by rule when the writer could not (the verse and chorus again)
    if (SECOND.test(b.said) && MORE.test(b.said)) {
      const two = lyricsSecondVerse(now);
      if (two !== now) return { lyrics: BRIDGE.test(b.said) ? lyricsWithBridge(two) : two, how: 'edit' };
    }
    // R17: a Cメロ / 大サビ by rule (「Cメロも足して」)
    if (BRIDGE.test(b.said) && MORE.test(b.said)) {
      const more = lyricsWithBridge(now);
      if (more !== now) return { lyrics: more, how: 'edit' };
    }
    return { lyrics: now, how: 'kept' };
  }

  /** one ask to the writer; its lyrics only when they pass moderation (null: failed / slow / not usable) */
  private async write(a: LyricsAsk): Promise<{ lyrics: SongLyrics | null; copy: boolean } | null> {
    try {
      const raw = await this.writer.chat({ system: lyricsSystem(), history: [{ role: 'user', text: lyricsRequest(a) }], temperature: a.mode === 'edit' ? 0.5 : 0.9, maxOutputTokens: 2000, json: true });
      const r = parseLyricsAnswer(raw);
      if (r.lyrics && (await moderateText(sung(r.lyrics))).flagged) return { lyrics: null, copy: r.copy };
      return r;
    } catch (e) {
      this.log.warn(`lyrics (${a.mode}) by rule: ${String(e)}`);
      return null;
    }
  }
}
