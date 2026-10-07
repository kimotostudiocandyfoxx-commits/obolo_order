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
import type { ComposeChatBody, ComposeChatResult, ComposeDesignBody, InstrumentalBody, InstrumentalResult, SongDesign } from '@obolo/shared';
import { AppConfig, CONFIG } from '../config';
import { MediaService } from '../media/media.service';
import { generateInstrumental, musicStatus } from './music.client';
import { apiError } from '../common/errors';
import { LLM } from '../infra/tokens';

/** Short reason for the client (no secrets: provider error text only), so a failure can be diagnosed. */
const why = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/\s+/g, ' ').slice(0, 160);

const turns = (h: ComposeChatBody['history']): ChatTurn[] => h.map((t) => ({ role: t.role === 'partner' ? 'assistant' : 'user', text: t.text }));

/**
 * Mercury 作曲, step 1 of the pipeline (client decision 2026-10-06): the partner chats with the
 * visitor, then the LLM (Gemini) writes the song and @obolo/ai builds the design (kana, chords,
 * melody). Step 2: the instrumental (ACE-Step 1.5 on the Cloud Run GPU). Step 3 (SongService):
 * the vocal (Fish Audio [singing] in the member's registered voice) mixed over it, then chat edits.
 */
@Injectable()
export class ComposeService {
  private readonly log = new Logger('Compose');
  constructor(
    @Inject(LLM) private readonly llm: LlmProvider,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly media: MediaService,
  ) {}

  async musicStatus() {
    if (!this.cfg.MUSIC_URL) return { reachable: false, error: 'MUSIC_URL not set' };
    return musicStatus(this.cfg.MUSIC_URL);
  }

  /** Step 2: the instrumental from the design (GPU service, gpu/music), stored on Bunny. */
  async instrumental(userId: string, body: InstrumentalBody, origin: string): Promise<InstrumentalResult> {
    if (!this.cfg.MUSIC_URL) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_OFF', 'The music studio is not connected yet');
    const { data, seconds } = await generateInstrumental(this.cfg.MUSIC_URL, body);
    const m = await this.media.storeAudio(userId, 'audio/mp4', data, origin);
    this.log.log(`instrumental ${userId} "${body.title}" ${seconds}s ${data.length}B`);
    return { url: m.url, seconds };
  }

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
      throw apiError(HttpStatus.BAD_GATEWAY, 'AI_FAILED', `The partner could not answer: ${why(e)}`);
    }
  }

  async design(body: ComposeDesignBody): Promise<SongDesign> {
    await this.checkWords(body, true);
    const partner = { name: body.partner, isBati: body.isBati };
    const req = { system: songDesignSystem(partner, body.genre), history: turns(body.history), json: true, temperature: 0.9, maxOutputTokens: 2000 };
    // one retry: the model sometimes returns lyrics without kana
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return buildSongDesign(await this.llm.chat(req), partner, body.genre);
      } catch (e) {
        last = e;
        this.log.warn(`design attempt ${attempt + 1} failed: ${String(e)}`);
      }
    }
    throw apiError(HttpStatus.BAD_GATEWAY, 'AI_FAILED', `The song could not be made: ${why(last)}`);
  }
}
