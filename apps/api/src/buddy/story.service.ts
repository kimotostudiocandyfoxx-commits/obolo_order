import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type LlmProvider, moderateText, storyCardsPrompt, storyWritePrompt } from '@obolo/ai';
import type { StoryBody, StoryResult } from '@obolo/shared';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { LLM } from '../infra/tokens';
import { LedgerService } from '../wallet/ledger.service';

const json = (raw: string) => JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>;

/**
 * 天王星 〔✒️ 書く〕 (L2-URANUS-S002, M-R158): what was said to {bati} becomes the story's spell cards (free, like the
 * other card-making), and the cards become a short story of a few pages (mana: MAKE_COST.story, asked before). The
 * story is not stored here: it goes to the member's own 〔🔒 机の引き出し〕 on the device.
 */
@Injectable()
export class StoryService {
  private readonly log = new Logger('Story');
  constructor(
    @Inject(LLM) private readonly llm: LlmProvider,
    private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  private async clean(text: string) {
    if ((await moderateText(text, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その言葉は使えません');
  }

  async cards(said: string): Promise<{ cards: string[] }> {
    await this.clean(said);
    let cards: string[] = [];
    try {
      const raw = await this.llm.chat({ system: storyCardsPrompt(), history: [{ role: 'user', text: said }], json: true, temperature: 0.5, maxOutputTokens: 300 });
      cards = ((json(raw).cards as unknown[]) ?? []).map((c) => String(c).trim().slice(0, 16)).filter((c) => c && !/\d/.test(c));
    } catch (e) {
      this.log.warn(`story cards failed: ${String(e)}`);
    }
    if (!cards.length) cards = [...said.split(/[、。！？!?\s　]+/).filter(Boolean).slice(0, 4).map((p) => p.slice(0, 12)), '短いお話'];
    return { cards: [...new Set(cards)].slice(0, 8) };
  }

  async write(userId: string, cards: string[], unlimited = false): Promise<StoryResult> {
    await this.clean(cards.join('、'));
    const fee = unlimited ? { refund: async () => undefined } : await this.ledger.charge(this.db, userId, 'story');
    try {
      const raw = await this.llm.chat({ system: storyWritePrompt(cards), history: [{ role: 'user', text: 'このスペルで、お話を書いて' }], json: true, temperature: 0.9, maxOutputTokens: 1500 });
      const j = json(raw) as { title?: string; pages?: { text?: string; scene?: string }[] };
      const pages = (j.pages ?? []).map((p) => ({ text: String(p.text ?? '').trim().slice(0, 300), scene: String(p.scene ?? '').trim().slice(0, 24) })).filter((p) => p.text).slice(0, 5);
      if (!pages.length) throw new Error('no pages');
      const story = { title: String(j.title ?? '').trim().slice(0, 20) || 'わたしのお話', pages };
      await this.clean(`${story.title}\n${pages.map((p) => p.text).join('\n')}`);
      return story;
    } catch (e) {
      await fee.refund();
      if (e instanceof HttpException) throw e;
      this.log.warn(`story write failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'STORY_FAILED', '羽ペンが、止まってしまった……');
    }
  }
}
