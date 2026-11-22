import { GoogleGenAI } from '@google/genai';
import { ClaudeProvider, LlmRefusalError, pickSources } from './claude';
import { mockSongDesign } from './song';
import { mockSongEdit } from './songEdit';
import type { ChatRequest, LlmProvider, SearchAnswer } from './types';

/**
 * Gemini wants the conversation to start with the user and to alternate: leading partner lines
 * (e.g. the greeting) move into the system text, consecutive lines of the same side are merged.
 */
export function geminiContents(req: ChatRequest): { system: string; contents: { role: 'user' | 'model'; parts: { text: string }[] }[] } {
  const turns = [...req.history];
  const lead: string[] = [];
  while (turns.length && turns[0].role === 'assistant') lead.push(turns.shift()!.text);
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const t of turns) {
    const role = t.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last?.role === role) last.parts[0].text += `\n${t.text}`;
    else contents.push({ role, parts: [{ text: t.text }] });
  }
  const system = lead.length ? `${req.system}\n\n（会話の最初にあなたが言ったこと：${lead.join(' / ')}）` : req.system;
  return { system, contents };
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;
  /** first model that answers is kept; the rest are fallbacks when a model name is unknown / retired */
  private readonly models: string[];
  constructor(apiKey: string, model: string | string[]) {
    this.client = new GoogleGenAI({ apiKey });
    this.models = Array.isArray(model) ? model : [model];
  }
  async chat(req: ChatRequest): Promise<string> {
    const { system, contents } = geminiContents(req);
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        const res = await this.client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: system,
            temperature: req.temperature ?? 0.9,
            maxOutputTokens: req.maxOutputTokens ?? 800,
            ...(req.json ? { responseMimeType: 'application/json' } : {}),
          },
        });
        const text = res.text?.trim();
        if (!text) throw new Error(`Gemini (${model}) returned an empty response`);
        return text;
      } catch (e) {
        lastErr = e;
        // only an unknown model name moves on to the next model
        if (!/404|not found|NOT_FOUND|is not supported/i.test(String(e))) throw e;
      }
    }
    throw lastErr;
  }

  /** Bati looks it up (M-R208): Google Search grounding; the pages come from the grounding metadata */
  async search(req: ChatRequest): Promise<SearchAnswer> {
    const { system, contents } = geminiContents(req);
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        const res = await this.client.models.generateContent({
          model,
          contents,
          config: { systemInstruction: system, temperature: req.temperature ?? 0.4, maxOutputTokens: req.maxOutputTokens ?? 800, tools: [{ googleSearch: {} }] },
        });
        const text = res.text?.trim();
        if (!text) throw new Error(`Gemini (${model}) returned an empty response`);
        const meta = res.candidates?.[0]?.groundingMetadata;
        const sources = pickSources((meta?.groundingChunks ?? []).map((c) => ({ url: c.web?.uri, title: c.web?.title, domain: c.web?.domain })));
        return { text, sources, searches: meta?.webSearchQueries?.length ? 1 : 0 };
      } catch (e) {
        lastErr = e;
        if (!/404|not found|NOT_FOUND|is not supported/i.test(String(e))) throw e;
      }
    }
    throw lastErr;
  }

  async perceive(input: { mime: string; data: Buffer } | { url: string }, prompt: string): Promise<string> {
    // a public YouTube link is passed as it is (Gemini reads it; nothing is downloaded)
    const media = 'url' in input ? { fileData: { fileUri: input.url } } : { inlineData: { mimeType: input.mime, data: input.data.toString('base64') } };
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        const res = await this.client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [media, { text: prompt }] }],
          config: { temperature: 0.4, maxOutputTokens: 900, responseMimeType: 'application/json' },
        });
        const text = res.text?.trim();
        if (!text) throw new Error(`Gemini (${model}) returned an empty response`);
        return text;
      } catch (e) {
        lastErr = e;
        if (!/404|not found|NOT_FOUND|is not supported/i.test(String(e))) throw e;
      }
    }
    throw lastErr;
  }

  async transcribe(audio: Buffer, mime: string): Promise<string> {
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        const res = await this.client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: mime, data: audio.toString('base64') } },
                { text: 'この音声で話されている言葉を、そのまま文字に起こしてください。話し言葉のまま、句読点は自然に入れる。説明や前置きは書かず、起こした文だけを出力。何も話していなければ空で返す。' },
              ],
            },
          ],
          config: { temperature: 0, maxOutputTokens: 600 },
        });
        return (res.text ?? '').trim();
      } catch (e) {
        lastErr = e;
        if (!/404|not found|NOT_FOUND|is not supported/i.test(String(e))) throw e;
      }
    }
    throw lastErr;
  }
}

/** Fallback provider (spec §2.2/§7.4). Plain fetch to keep the dependency surface small. */
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}
  async chat(req: ChatRequest): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: req.temperature ?? 0.9,
        max_tokens: req.maxOutputTokens ?? 800,
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: req.system }, ...req.history.map((t) => ({ role: t.role, content: t.text }))],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty response');
    return text;
  }
}

/**
 * Offline provider used when no API key is configured (local dev / preview without secrets).
 * Gives in-character canned replies so the Moon UI can be demoed end-to-end.
 */
export class MockProvider implements LlmProvider {
  readonly name = 'mock';
  /** Offline: there is no speech recognition, a fixed line keeps the flow testable. */
  async transcribe(): Promise<string> {
    return 'テストの声です';
  }
  /** Offline: a fixed read keeps the compass testable */
  async perceive(_input: unknown, prompt: string): Promise<string> {
    const song = prompt.includes('song');
    return JSON.stringify({
      cards: song
        ? [{ group: 'ジャンル', text: 'シティポップ' }, { group: '速さとリズム', text: 'ゆったり' }, { group: '楽器', text: 'ピアノ' }, { group: '声', text: 'やわらかい声' }, { group: '曲の形', text: 'サビから始まる' }, { group: '雰囲気', text: '夜のドライブ' }]
        : [{ group: '絵のタッチ', text: '水彩' }, { group: '絵のタッチ', text: 'にじみ' }, { group: 'キャラ', text: '二頭身' }, { group: '背景', text: '夕暮れの海辺' }, { group: '色と光', text: '逆光' }, { group: '構図', text: '下から見上げる' }, { group: '雰囲気', text: 'なつかしい' }],
    });
  }
  /** Offline: a fixed answer with one made-up page, so the link chips can be seen (no network) */
  async search(req: ChatRequest): Promise<SearchAnswer> {
    const last = [...req.history].reverse().find((t) => t.role === 'user')?.text ?? '';
    return { text: `「${last.slice(0, 20)}」のこと、調べたらこうなんだって！（テスト用の答え）`, sources: [{ title: 'テスト用のページ', url: 'https://example.com/', domain: 'example.com' }], searches: 0 };
  }
  async chat(req: ChatRequest): Promise<string> {
    const last = [...req.history].reverse().find((t) => t.role === 'user')?.text ?? '';
    if (req.json && req.system.includes('SONG_DESIGN')) return mockSongDesign(last);
    if (req.json && req.system.includes('SONG_EDIT')) return mockSongEdit(last);
    const ja = /[぀-ヿ一-龯]/.test(last) || req.system.includes('あなたは');
    if (req.system.includes('長期記憶') || req.system.includes('long-term memory')) {
      // Offline "summary": keep existing bullets + the user's latest lines.
      const existing = last.split('\n').filter((l) => l.startsWith('- '));
      const said = last
        .split('\n')
        .filter((l) => l.startsWith('USER: '))
        .slice(-3)
        .map((l) => `- ${ja ? 'ユーザーの発言' : 'User said'}: ${l.slice(6, 60)}`);
      return [...new Set([...existing, ...said])].slice(-15).join('\n');
    }
    const pick = <T,>(xs: T[]) => xs[last.length % xs.length];
    return ja
      ? pick([
          `「${last.slice(0, 24)}」かぁ、いいね！🌙 もっと聞かせて！`,
          `なるほど〜！それ、すごく面白いと思う✨ どうしてそう思ったの？`,
          `うんうん、わかるよ。ボクはいつでもキミの味方だからね🎵`,
        ])
      : pick([
          `"${last.slice(0, 24)}" — ooh, tell me more! 🌙`,
          `That's really interesting ✨ What made you think of it?`,
          `I hear you. I'm always on your side 🎵`,
        ]);
  }
}

/** Tries providers in order; returns the first successful answer. */
export class FallbackProvider implements LlmProvider {
  readonly name: string;
  readonly oneCall?: boolean;
  constructor(
    private readonly providers: LlmProvider[],
    private readonly onError?: (provider: string, err: unknown) => void,
  ) {
    this.name = providers.map((p) => p.name).join('>');
    this.oneCall = providers[0]?.oneCall;
  }
  async chat(req: ChatRequest): Promise<string> {
    let lastErr: unknown;
    for (const p of this.providers) {
      try {
        return await p.chat(req);
      } catch (err) {
        // a refusal is an answer, not an outage: the caller handles it (no other model is asked)
        if (err instanceof LlmRefusalError) throw err;
        lastErr = err;
        this.onError?.(p.name, err);
      }
    }
    throw lastErr ?? new Error('No LLM provider configured');
  }

  /** the first provider streams; if it fails before writing anything, the next ones answer in one piece */
  async stream(req: ChatRequest, onText: (piece: string) => void): Promise<string> {
    let lastErr: unknown;
    for (const p of this.providers) {
      let wrote = false;
      try {
        if (p.stream)
          return await p.stream(req, (t) => {
            wrote = true;
            onText(t);
          });
        const text = await p.chat(req);
        onText(text);
        return text;
      } catch (err) {
        if (err instanceof LlmRefusalError || wrote) throw err;
        lastErr = err;
        this.onError?.(p.name, err);
      }
    }
    throw lastErr ?? new Error('No LLM provider configured');
  }

  /** the first provider that can search; an outage moves on to the next one that can (a refusal does not) */
  async search(req: ChatRequest): Promise<SearchAnswer> {
    let lastErr: unknown;
    for (const p of this.providers) {
      if (!p.search) continue;
      try {
        return await p.search(req);
      } catch (err) {
        if (err instanceof LlmRefusalError) throw err;
        lastErr = err;
        this.onError?.(p.name, err);
      }
    }
    throw lastErr ?? new Error('No provider can search');
  }

  async perceive(input: { mime: string; data: Buffer } | { url: string }, prompt: string): Promise<string> {
    const p = this.providers.find((x) => x.perceive);
    if (!p?.perceive) throw new Error('No provider can look or listen');
    return p.perceive(input, prompt);
  }

  async transcribe(audio: Buffer, mime: string): Promise<string> {
    const p = this.providers.find((x) => x.transcribe);
    if (!p?.transcribe) throw new Error('No speech-to-text provider');
    return p.transcribe(audio, mime);
  }
}

export interface LlmConfig {
  /** Bati's conversation (createBuddyLlm): Claude Haiku 5.5 when set (client decision 2026-11-21) */
  anthropicApiKey?: string;
  anthropicModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  onError?: (provider: string, err: unknown) => void;
}

/** Build the provider chain from config. With no keys at all, falls back to MockProvider. */
export function createLlm(cfg: LlmConfig): LlmProvider {
  const chain: LlmProvider[] = [];
  // P-AI-1: Flash-Lite for every text call (Bati chat on all planets, song design) — client, 2026-10-06 (cost).
  // The "-latest" alias follows Google's current Flash-Lite, so a retired version never breaks the app.
  if (cfg.geminiApiKey) chain.push(new GeminiProvider(cfg.geminiApiKey, cfg.geminiModel ? [cfg.geminiModel] : ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite']));
  if (cfg.openaiApiKey) chain.push(new OpenAiProvider(cfg.openaiApiKey, cfg.openaiModel || 'gpt-4o-mini'));
  if (chain.length === 0) return new MockProvider();
  return chain.length === 1 ? chain[0] : new FallbackProvider(chain, cfg.onError);
}

/**
 * Bati's conversation (client decision 2026-11-21): Claude Haiku 5.5, with the ordinary chain (Gemini) behind it for an
 * outage. Without an Anthropic key it is the ordinary chain, so the app keeps working until the key is set.
 */
export function createBuddyLlm(cfg: LlmConfig): LlmProvider {
  const base = createLlm(cfg);
  if (!cfg.anthropicApiKey) return base;
  const claude = new ClaudeProvider(cfg.anthropicApiKey, cfg.anthropicModel || undefined);
  return base.name === 'mock' ? claude : new FallbackProvider([claude, base], cfg.onError);
}
