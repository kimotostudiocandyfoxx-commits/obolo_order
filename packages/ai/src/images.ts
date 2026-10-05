import { GoogleGenAI } from '@google/genai';

/**
 * Image generation for the OBOLO NEO look (Day 3) and the newborn Bati (Day 4)
 * (client decision 2026-10-05). PLACEHOLDER (P-AI-3): model and prompts are first drafts.
 */
export interface GeneratedImage {
  data: Buffer;
  mime: string;
}

export interface ImageProvider {
  readonly name: string;
  generate(prompt: string, seed?: number): Promise<GeneratedImage>;
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = 'gemini-image';
  private readonly client: GoogleGenAI;
  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }
  async generate(prompt: string): Promise<GeneratedImage> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { responseModalities: ['IMAGE'] },
    });
    for (const part of res.candidates?.[0]?.content?.parts ?? []) {
      const d = part.inlineData;
      if (d?.data) return { data: Buffer.from(d.data, 'base64'), mime: d.mimeType || 'image/png' };
    }
    throw new Error('Gemini returned no image');
  }
}

/** No API key: a simple SVG emblem so the flow still works in development. */
export class MockImageProvider implements ImageProvider {
  readonly name = 'mock-image';
  async generate(prompt: string, seed = 0): Promise<GeneratedImage> {
    const h = ([...prompt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) + seed * 67) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="hsl(${h},80%,70%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},60%,22%)"/></radialGradient></defs><rect width="512" height="512" fill="url(#g)"/><circle cx="256" cy="270" r="150" fill="hsl(${h},70%,85%)" opacity=".9"/><circle cx="206" cy="250" r="18" fill="#222"/><circle cx="306" cy="250" r="18" fill="#222"/><path d="M216 320 Q256 350 296 320" stroke="#222" stroke-width="10" fill="none" stroke-linecap="round"/></svg>`;
    return { data: Buffer.from(svg), mime: 'image/svg+xml' };
  }
}

export function createImageProvider(cfg: { geminiApiKey?: string; imageModel?: string }): ImageProvider {
  return cfg.geminiApiKey ? new GeminiImageProvider(cfg.geminiApiKey, cfg.imageModel || 'gemini-2.5-flash-image') : new MockImageProvider();
}

const STYLE =
  'Illustration in the style of a dark-fantasy anime mascot game: richly detailed, cute but mysterious, soft cinematic lighting, ' +
  'single character, full body, centered, facing the viewer, on a deep starry night-sky background with a faint glow. ' +
  'Square image. No text, no letters, no logo, no watermark.';

/** Day 3: the visitor's OBOLO NEO look from three answers. */
export function neoLookPrompt(a: { animal: string; color: string; mood: string }, variant: number): string {
  const poses = ['standing proudly', 'waving one paw', 'with a small cape fluttering', 'holding a tiny glowing star'];
  return `${STYLE} The character is an anthropomorphic ${a.animal} apprentice of a secret society, wearing a hooded robe whose main color is ${a.color}. Mood and vibe: ${a.mood}. Pose: ${poses[variant % poses.length]}.`;
}

/** Day 4: the newborn Bati, a small round creature inspired by the visitor's favourite food. */
export function batiPrompt(food: string): string {
  return `${STYLE} The character is a newborn magical partner creature called Bati: small, round and chubby, with big sparkling eyes, whose body, colors and accessories are inspired by "${food}". It looks friendly and happy, as if it just hatched from an egg (a few eggshell pieces nearby).`;
}
