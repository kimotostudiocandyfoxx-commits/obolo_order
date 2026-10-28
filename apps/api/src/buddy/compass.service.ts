import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { COMPASS_GROUPS, compassPrompt, type LlmProvider, moderateText } from '@obolo/ai';
import type { CompassBody, CompassCard } from '@obolo/shared';
import { apiError } from '../common/errors';
import { LLM } from '../infra/tokens';

/**
 * 〔🧭 スペルコンパス〕 (M-R167/M-R168): reads a picture (Jupiter) or a song (Mercury — a short clip played next to
 * the phone, or a public YouTube link passed as it is) into spell cards grouped by kind. The picture and the sound
 * are only looked at, never stored; no mana. Real names never become cards (the prompt says so, and a card that
 * looks like a name in Latin letters or fails the text check is dropped).
 */
@Injectable()
export class CompassService {
  private readonly log = new Logger('Compass');
  constructor(@Inject(LLM) private readonly llm: LlmProvider) {}

  async read(body: CompassBody): Promise<CompassCard[]> {
    if (!this.llm.perceive) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'NO_COMPASS', 'コンパスが、いまは回らないよ');
    const input = body.url ? { url: body.url } : { mime: body.media!.mime, data: Buffer.from(body.media!.data, 'base64') };
    let raw = '';
    try {
      raw = await this.llm.perceive(input, compassPrompt(body.kind, body.focus));
    } catch (e) {
      this.log.warn(`compass failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'COMPASS_FAILED', '羽ペンが、止まらなかった……');
    }
    const groups = COMPASS_GROUPS[body.kind];
    let cards: CompassCard[] = [];
    try {
      const j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { cards?: { group?: string; text?: string }[] };
      cards = (j.cards ?? [])
        .map((c) => ({ group: groups.includes(c.group ?? '') ? c.group! : groups[groups.length - 1], text: (c.text ?? '').trim().slice(0, 14) }))
        // no Latin-letter names, no numbers
        .filter((c) => c.text && !/[A-Za-z]{3,}|\d/.test(c.text));
    } catch {
      cards = [];
    }
    const seen = new Set<string>();
    cards = cards.filter((c) => !seen.has(c.text) && seen.add(c.text)).slice(0, 24);
    if (cards.length && (await moderateText(cards.map((c) => c.text).join('、'), this.llm)).flagged) return [];
    return cards;
  }
}
