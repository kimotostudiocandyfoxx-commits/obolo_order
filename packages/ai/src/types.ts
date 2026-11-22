export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface ChatRequest {
  system: string;
  history: ChatTurn[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask for a JSON object as the whole answer (song design etc.). */
  json?: boolean;
}

/** Provider-agnostic LLM interface (spec §7.4). Gemini primary, OpenAI fallback. */
export interface LlmProvider {
  readonly name: string;
  chat(req: ChatRequest): Promise<string>;
  /** speech → text (the member's own recording becomes the words of their post) */
  transcribe?(audio: Buffer, mime: string): Promise<string>;
  /** look at a picture / listen to a sound (inline), or a public YouTube link, and answer the prompt as JSON */
  perceive?(input: { mime: string; data: Buffer } | { url: string }, prompt: string): Promise<string>;
  /** the answer as it is written: onText gets each new piece, the promise the whole text */
  stream?(req: ChatRequest, onText: (piece: string) => void): Promise<string>;
  /** sorts a question and answers it in one call (Bati's one-call prompt; Claude) */
  readonly oneCall?: boolean;
  /**
   * The answer from a web search (M-R208): Claude's web search server tool, or Gemini's Google Search grounding.
   * `sources` are the pages the answer is based on (at most a few); `searches` the searches it took (cost).
   */
  search?(req: ChatRequest): Promise<SearchAnswer>;
}

/** a page a searched answer is based on */
export interface WebSource {
  title: string;
  url: string;
  /** the site's name to show (e.g. "ja.wikipedia.org") */
  domain: string;
}

export interface SearchAnswer {
  text: string;
  sources: WebSource[];
  searches: number;
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}
