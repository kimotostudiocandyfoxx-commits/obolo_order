import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  buildSongDesign,
  composeChatSystem,
  type ChatTurn,
  type LlmProvider,
  moderateText,
  parseComposeChat,
  songDesignSystem,
} from '@obolo/ai';
import type { ComposeChatBody, ComposeChatResult, ComposeDesignBody, SongDesign } from '@obolo/shared';
import { apiError } from '../common/errors';
import { LLM } from '../infra/tokens';

const turns = (h: ComposeChatBody['history']): ChatTurn[] => h.map((t) => ({ role: t.role === 'partner' ? 'assistant' : 'user', text: t.text }));

/**
 * Mercury 作曲, step 1 of the pipeline (client decision 2026-10-06): the partner chats with the
 * visitor, then the LLM (Gemini) writes the song and @obolo/ai builds the design (kana, chords,
 * melody). Next steps: the instrumental (MusicGen) and the vocal (DiffSinger) on the GPU worker.
 */
@Injectable()
export class ComposeService {
  private readonly log = new Logger('Compose');
  constructor(@Inject(LLM) private readonly llm: LlmProvider) {}

  private async checkWords(body: ComposeChatBody, deep: boolean) {
    const said = body.history.filter((t) => t.role === 'user').map((t) => t.text).join('\n');
    const m = await moderateText(said, deep ? this.llm : undefined);
    if (m.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot become a song');
  }

  async chat(body: ComposeChatBody): Promise<ComposeChatResult> {
    await this.checkWords(body, false);
    try {
      const raw = await this.llm.chat({ system: composeChatSystem({ name: body.partner, isBati: body.isBati }), history: turns(body.history), json: true, temperature: 0.8, maxOutputTokens: 300 });
      return parseComposeChat(raw);
    } catch (e) {
      this.log.warn(`chat failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'AI_FAILED', 'The partner could not answer');
    }
  }

  async design(body: ComposeDesignBody): Promise<SongDesign> {
    await this.checkWords(body, true);
    const partner = { name: body.partner, isBati: body.isBati };
    const req = { system: songDesignSystem(partner, body.genre), history: turns(body.history), json: true, temperature: 0.9, maxOutputTokens: 2000 };
    // one retry: the model sometimes returns lyrics without kana
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return buildSongDesign(await this.llm.chat(req), partner, body.genre);
      } catch (e) {
        this.log.warn(`design attempt ${attempt + 1} failed: ${String(e)}`);
      }
    }
    throw apiError(HttpStatus.BAD_GATEWAY, 'AI_FAILED', 'The song could not be made');
  }
}
