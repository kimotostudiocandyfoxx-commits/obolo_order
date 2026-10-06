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
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}
