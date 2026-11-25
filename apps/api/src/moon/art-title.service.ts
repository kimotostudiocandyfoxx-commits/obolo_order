import { Inject, Injectable, Logger } from '@nestjs/common';
import { artTitleRequest, artTitleSystem, moderateText, parseArtTitle, type LlmProvider } from '@obolo/ai';
import { artTitleFallback, type ArtTitleBody, type ArtTitleView } from '@obolo/shared';
import { LYRICS_LLM } from '../infra/tokens';

/**
 * Story 2026-11-25: POST /moon/art-title — {bati}'s ONE title for a picture painted in the Moon atelier, from its spell.
 * The same small writer and the same booking as a song's name (it comes with the lyrics, LyricsService): LYRICS_LLM,
 * free to the member, its provider cost recorded as the 'lyrics' feature's small cost (cost-scope featureOfPath). The
 * writer failing is no failure: a title by rule (artTitleFallback). A title that does not pass moderation is never given.
 */
@Injectable()
export class ArtTitleService {
  private readonly log = new Logger('ArtTitle');
  constructor(@Inject(LYRICS_LLM) private readonly writer: LlmProvider) {}

  async title(b: ArtTitleBody): Promise<ArtTitleView> {
    try {
      const raw = await this.writer.chat({ system: artTitleSystem(), history: [{ role: 'user', text: artTitleRequest({ tags: b.tags, said: b.said, before: b.before }) }], temperature: 0.9, maxOutputTokens: 200, json: true });
      const t = parseArtTitle(raw);
      if (t && t !== b.before && !(await moderateText(t)).flagged) return { title: t, how: 'writer' };
    } catch (e) {
      this.log.warn(`art title by rule: ${String(e)}`);
    }
    const rule = artTitleFallback(b.tags, b.said);
    return { title: rule === b.before ? 'むだい' : rule, how: 'rule' };
  }
}
