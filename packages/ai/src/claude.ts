import Anthropic from '@anthropic-ai/sdk';
import type { ChatRequest, LlmProvider } from './types';

/** Bati's conversation model (client decision 2026-11-21, docs/工房とブルーナ_設計.md §14) — a fixed id, never an alias. */
export const CLAUDE_BUDDY_MODEL = 'claude-haiku-5-5';

/** Claude declined the turn (`stop_reason: "refusal"`): Haiku 5.5 has no server-side fallback, the caller answers itself. */
export class LlmRefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`refused${category ? ` (${category})` : ''}`);
    this.name = 'LlmRefusalError';
  }
}

/**
 * The conversation must start with the user: leading partner lines (a greeting) move into the system text, the same
 * way as for Gemini. Consecutive lines of the same side are allowed (the API joins them).
 */
export function claudeMessages(req: ChatRequest): { system: string; messages: Anthropic.MessageParam[] } {
  const turns = [...req.history];
  const lead: string[] = [];
  while (turns.length && turns[0].role === 'assistant') lead.push(turns.shift()!.text);
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.text }));
  if (!messages.length) messages.push({ role: 'user', content: '…' });
  const system = lead.length ? `${req.system}\n\n（会話の最初にあなたが言ったこと：${lead.join(' / ')}）` : req.system;
  return { system, messages };
}

/**
 * Claude (Haiku 5.5) for Bati's conversation. Adaptive thinking is on by default on Haiku 5.5, so `thinking` is not
 * sent; depth is `effort: "low"`. No `temperature` (Haiku 5.5 rejects non-default sampling values). `max_tokens` leaves
 * room for the thinking: the caller's maxOutputTokens is the visible answer only.
 */
export class ClaudeProvider implements LlmProvider {
  readonly name = 'claude';
  /** answers sorting and replying in one call (buddyAnswer uses its one-call path) */
  readonly oneCall = true;
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    private readonly model: string = CLAUDE_BUDDY_MODEL,
    client?: Anthropic,
  ) {
    this.client = client ?? new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
  }

  private params(req: ChatRequest): Anthropic.MessageCreateParamsNonStreaming {
    const { system, messages } = claudeMessages(req);
    return {
      model: this.model,
      // thinking comes out of the same budget: a small visible answer still needs room to think first
      max_tokens: Math.max(400, (req.maxOutputTokens ?? 800) * 3),
      system,
      messages,
      output_config: { effort: 'low' },
    };
  }

  async chat(req: ChatRequest): Promise<string> {
    const res = await this.client.messages.create(this.params(req));
    return textOf(res);
  }

  /** the answer as it is written (onText gets each new piece); resolves to the whole text */
  async stream(req: ChatRequest, onText: (piece: string) => void): Promise<string> {
    const s = this.client.messages.stream(this.params(req));
    s.on('text', (piece) => onText(piece));
    const res = await s.finalMessage();
    return textOf(res);
  }
}

function textOf(res: Anthropic.Message): string {
  if (res.stop_reason === 'refusal') throw new LlmRefusalError(res.stop_details?.category ?? null);
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error(`Claude (${res.model}) returned no text (${res.stop_reason})`);
  return text;
}
