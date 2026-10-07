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
  /** `refs`: images the model looks at (a reference to take inspiration from, or the image to edit). */
  generate(prompt: string, seed?: number, refs?: GeneratedImage[]): Promise<GeneratedImage>;
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
  async generate(prompt: string, _seed?: number, refs: GeneratedImage[] = []): Promise<GeneratedImage> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.data.toString('base64') } })), { text: prompt }],
        },
      ],
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

const ORIGINAL =
  'IMPORTANT: the result must be a completely NEW, ORIGINAL character. Do NOT reproduce, trace or imitate any existing ' +
  'character, mascot, costume, logo or trademark from anime, games, films or brands; change the face, outfit design, ' +
  'silhouette and details so it is clearly a different character.';

/**
 * Day 3 (client decision 2026-10-05): start from a reference image the visitor likes. KIMORIN asks
 * which part they love (`liked`) and what twist makes it theirs (`twist`), so only elements are taken.
 */
export function neoFromReferencePrompt(a: { liked: string; twist: string }, variant: number): string {
  const poses = ['standing proudly', 'waving one hand', 'with a small cape fluttering', 'holding a tiny glowing star'];
  return `${STYLE} Use the attached image ONLY as loose inspiration for this element: "${a.liked}". ${ORIGINAL} Add this personal twist: "${a.twist}". The character is an apprentice of a secret society wearing a hooded robe. Pose: ${poses[variant % poses.length]}.`;
}

/** Day 3: refine the chosen look with one instruction ("bluer", "longer ears"…). */
export function refineLookPrompt(instruction: string): string {
  return `${STYLE} Edit the attached character image following this request: "${instruction}". Keep the same character identity, art style, framing and background. ${ORIGINAL}`;
}

/**
 * Saturn picture character (client decision 2026-10-07): a round, glossy "mochi" mascot in the
 * style of the attached style sheet (the client's reference characters). Plain white background
 * so the server can cut it out. The body must be one round ball filling the frame — it is warped
 * as a soft body in the app.
 */
/**
 * Jupiter butterfly (client request 2026-10-07: new art is made with Gemini): a cute chibi
 * character with butterfly wings, in the style of the client's パタパタ butterflies (style sheet).
 */
export function butterflyPrompt(description: string, hasReference: boolean, variant: number): string {
  const moods = ['happy and smiling', 'calm and gentle', 'proud and cheerful', 'shy with a soft smile'];
  return (
    'Draw ONE cute chibi character with butterfly wings, in exactly the art style of the FIRST attached image (the style sheet): ' +
    'soft hand-painted storybook illustration, warm muted colours, a round chubby little body standing upright, a big head, ' +
    'small shiny eyes, pink blush, two curly antennae on top, and two big rounded butterfly wings spread behind the body with ' +
    'pretty patterns that match the character (flowers, moons, stars, swirls). Outfit and accessories match the concept. ' +
    `Character concept: "${description}". Mood: ${moods[variant % moods.length]}. ` +
    (hasReference ? 'Use the SECOND attached image as the character to turn into this butterfly (keep its colours, face and motifs). ' : '') +
    'Composition: front view, the whole character and both wings fully visible and centered, filling about 85% of a square frame. ' +
    'Background: plain flat pure white (#FFFFFF), no ground, no shadow, no other objects. No text, no letters, no logo, no watermark. ' +
    ORIGINAL
  );
}

export function puniPicPrompt(description: string, hasReference: boolean, variant: number): string {
  const moods = ['happy and smiling', 'cheerful with a tiny wink feel', 'sleepy and calm', 'excited'];
  return (
    'Draw ONE cute kawaii mascot character in exactly the art style of the FIRST attached image (the style sheet): ' +
    'a round, glossy, mochi-like ball body that is almost a perfect circle, soft pastel digital painting, a big soft highlight ' +
    'on the upper left, gentle shading, small shiny dark eyes with white sparkles, a tiny "ω" cat mouth, pink blush on the cheeks, ' +
    'tiny stubby arms and feet that stay close to the body. Accessories and patterns are painted ON or tightly around the round body. ' +
    `Character concept: "${description}". Mood: ${moods[variant % moods.length]}. ` +
    (hasReference ? 'Use the SECOND attached image only as loose inspiration for colours and motifs, turned into this round mascot. ' : '') +
    'Composition: the round body is centered and fills about 80% of a square frame, front view, nothing cut off. ' +
    'Background: plain flat pure white (#FFFFFF), no ground, no shadow, no other objects. No text, no letters, no logo, no watermark. ' +
    ORIGINAL
  );
}
