import { ClaudeProvider } from './claude';
import { FallbackProvider, GeminiProvider, MockProvider, OpenAiProvider } from './providers';
import type { ChatRequest, LlmProvider } from './types';

/**
 * A per-task model setting (client 2026-11-25: books and games on Gemini now, Claude later by config only). A spec is a
 * comma-separated chain of `provider:model`, tried in order — any failure of one (a timeout, a quota, an outage) moves
 * on to the next. Providers: gemini, claude, openai. A step whose key is not set is skipped; nothing usable → the mock.
 *   NOVEL_MODEL=gemini:gemini-2.5-flash,gemini:gemini-flash-latest
 *   GAME_MODEL=gemini:gemini-2.5-pro,gemini:gemini-2.5-flash      (later: claude:claude-opus-…,gemini:gemini-2.5-pro)
 *   LYRICS_MODEL=gemini:gemini-2.5-flash,gemini:gemini-flash-latest
 */
export const TASK_MODEL_DEFAULTS = {
  /** a book's chapters: Flash-class (long Japanese prose, cheap) */
  novel: 'gemini:gemini-2.5-flash,gemini:gemini-flash-latest',
  /** a game's code: Pro-class, Flash behind it for a timeout / the quota */
  game: 'gemini:gemini-2.5-pro,gemini:gemini-2.5-flash',
  /** R13: a song's lyrics with metatags (Japanese, short, JSON): Flash-class; Claude later by LYRICS_MODEL only */
  lyrics: 'gemini:gemini-2.5-flash,gemini:gemini-flash-latest',
  /** R14: every スペル is built by the model first (short JSON, must be quick): Flash-class; Claude by SPELL_MODEL */
  spell: 'gemini:gemini-2.5-flash,gemini:gemini-flash-latest',
} as const;
export type TaskName = keyof typeof TASK_MODEL_DEFAULTS;

export type ModelStep = { provider: 'gemini' | 'claude' | 'openai'; model: string };
export function parseModelSpec(spec: string): ModelStep[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s): ModelStep[] => {
      const m = s.match(/^(gemini|claude|anthropic|openai):(.+)$/i);
      if (!m) return /^gemini|^claude|^gpt/i.test(s) ? [{ provider: /^claude/i.test(s) ? 'claude' : /^gpt/i.test(s) ? 'openai' : 'gemini', model: s }] : [];
      const p = m[1].toLowerCase();
      return [{ provider: p === 'anthropic' ? 'claude' : (p as ModelStep['provider']), model: m[2].trim() }];
    });
}

/** a provider that gives up after `ms` (so a slow Pro call falls back to Flash) */
export class TimeoutProvider implements LlmProvider {
  readonly name: string;
  constructor(
    private readonly inner: LlmProvider,
    private readonly ms: number,
  ) {
    this.name = inner.name;
  }
  chat(req: ChatRequest): Promise<string> {
    return Promise.race([this.inner.chat(req), new Promise<never>((_, no) => setTimeout(() => no(new Error(`${this.inner.name} timed out after ${this.ms} ms`)), this.ms))]);
  }
}

export function createTaskLlm(spec: string, keys: { geminiApiKey?: string; anthropicApiKey?: string; openaiApiKey?: string }, o: { timeoutMs?: number; onError?: (provider: string, err: unknown) => void } = {}): LlmProvider {
  const chain: LlmProvider[] = [];
  for (const s of parseModelSpec(spec)) {
    const p =
      s.provider === 'gemini' && keys.geminiApiKey
        ? new GeminiProvider(keys.geminiApiKey, s.model)
        : s.provider === 'claude' && keys.anthropicApiKey
          ? new ClaudeProvider(keys.anthropicApiKey, s.model)
          : s.provider === 'openai' && keys.openaiApiKey
            ? new OpenAiProvider(keys.openaiApiKey, s.model)
            : null;
    if (!p) continue;
    const named = Object.assign(Object.create(Object.getPrototypeOf(p)), p, { name: `${s.provider}:${s.model}` }) as LlmProvider;
    chain.push(o.timeoutMs ? new TimeoutProvider(named, o.timeoutMs) : named);
  }
  if (!chain.length) return new MockProvider();
  return chain.length === 1 ? chain[0] : new FallbackProvider(chain, o.onError);
}
