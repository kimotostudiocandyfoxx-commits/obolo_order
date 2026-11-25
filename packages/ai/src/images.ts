import { GoogleGenAI } from '@google/genai';
import { meterGemini, meterRunware } from './meter';

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
    meterGemini(this.model, res.usageMetadata);
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

/**
 * Seedream 5.0 Pro on Runware (client decision 2026-10-25: the looks and the Bati are painted by Seedream —
 * the most beautiful in the side-by-side test, ~2–7 yen a picture). `refs` are handed as reference images.
 */
const SEEDREAM_MODEL = 'bytedance:seedream@5.0-pro';

/**
 * R17: how a Runware model takes the reference pictures — `referenceImages` (Seedream, FLUX.2 / FLUX 3 klein, Qwen-Image,
 * Nano Banana, P-Image Edit …), Runware's IP-Adapter on a community SDXL checkpoint (civitai:…: Animagine, Illustrious),
 * or none (a words-only model: the references are left out)
 */
export function runwareRefMode(model: string): { mode: 'refs' | 'ip' | 'none'; max: number } {
  if (/^civitai:/i.test(model)) return { mode: 'ip', max: 1 };
  if (/z-image|^prunaai:1@|twinflow/i.test(model)) return { mode: 'none', max: 0 };
  if (/^runware:400@|^bfl:flux@3|^prunaai:2@/i.test(model)) return { mode: 'refs', max: 4 };
  if (/qwen-image/i.test(model)) return { mode: 'refs', max: 3 };
  return { mode: 'refs', max: 10 };
}
/** Runware's IP-Adapter for SDXL (the MV chibi cuts use the same) */
const IP_ADAPTER = 'runware:55@1';
const SDXL_NEGATIVE = 'lowres, bad anatomy, bad hands, text, watermark, signature, worst quality, low quality, photo, realistic, 3d, nsfw, nude';

/** the Runware task of one picture on `model` (R17: any AIR id; includeCost always) */
export function runwareImageTask(model: string, taskUUID: string, prompt: string, side: number, refs: GeneratedImage[]): Record<string, unknown> {
  const uri = (r: GeneratedImage) => `data:${r.mime};base64,${r.data.toString('base64')}`;
  const how = runwareRefMode(model);
  const sdxl = how.mode === 'ip';
  return {
    taskType: 'imageInference',
    taskUUID,
    model,
    positivePrompt: prompt.slice(0, sdxl ? 1900 : 3000),
    width: side,
    height: side,
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'JPG',
    includeCost: true,
    ...(sdxl ? { negativePrompt: SDXL_NEGATIVE, steps: 28, CFGScale: 5 } : {}),
    ...(refs.length && how.mode === 'refs' ? { referenceImages: refs.slice(0, how.max).map(uri) } : {}),
    ...(refs.length && how.mode === 'ip' ? { ipAdapters: [{ model: IP_ADAPTER, guideImage: uri(refs[0]), weight: 0.6 }] } : {}),
  };
}

/**
 * A picture on Runware by any AIR id (R17: ART_MODEL / LOOK_MODEL / BATI_MODEL / KORORIN_MODEL). Seedream 5.0 Pro was the
 * only one before; the waiting line, the retries and the polling are the same for every model.
 */
export class RunwareImageProvider implements ImageProvider {
  readonly name: string;
  // 1024, not 1536 (generation test 1, I: 54–179 s a look; the screen shows them at 720 at most), and at most twelve at
  // once from one server (four made a line longer than five minutes in test 2), the rest waiting in line: a burst of twelve made Runware give up at about 120 s (half the
  // Bati births came back with no picture)
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(
    private readonly apiKey: string,
    private readonly side = 1024,
    private readonly maxAtOnce = 12,
    /** one picture's whole wait (2026-10-29: a look waited minutes and the screen sat on 「水盤が描いている」) */
    private readonly timeoutMs = 115_000,
    readonly model: string = SEEDREAM_MODEL,
  ) {
    this.name = model === SEEDREAM_MODEL ? 'seedream' : `runware:${model}`;
  }
  async generate(prompt: string, seed?: number, refs: GeneratedImage[] = []): Promise<GeneratedImage> {
    if (this.running >= this.maxAtOnce) await new Promise<void>((go) => this.waiting.push(go));
    this.running++;
    try {
      // Runware refuses while the account's reserved credit is used up (concurrentRequestLimitExceeded, generation
      // test run 3): wait for the others to finish and try again, a few times
      for (let k = 0; ; k++) {
        try {
          return await this.paint(prompt, seed, refs);
        } catch (e) {
          if (k >= 2 || !/concurrentRequestLimitExceeded/.test(String(e))) throw e;
          await new Promise((r) => setTimeout(r, 4000 * (k + 1)));
        }
      }
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
  /** a picture still being made comes back without its URL ("processing"): ask for it by its task (2026-10-29: the look stuck) */
  private async waitFor(taskUUID: string, until: number): Promise<string> {
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify([{ taskType: 'getResponse', taskUUID }]),
        signal: AbortSignal.timeout(20_000),
      });
      const j = (await res.json().catch(() => ({}))) as { data?: { taskUUID?: string; imageURL?: string; status?: string; cost?: number }[]; errors?: unknown[] };
      if (j.errors?.length) throw new Error(`${this.name} ${res.status} ${JSON.stringify(j.errors).slice(0, 200)}`);
      const d = (j.data ?? []).find((x) => x.taskUUID === taskUUID);
      if (d?.status === 'error') throw new Error(`${this.name} ${JSON.stringify(d).slice(0, 200)}`);
      if (d?.imageURL) {
        meterRunware(this.model, [d]);
        return d.imageURL;
      }
    }
    throw new Error(`${this.name}: the picture did not come back in time`);
  }
  private async paint(prompt: string, _seed?: number, refs: GeneratedImage[] = []): Promise<GeneratedImage> {
    const taskUUID = crypto.randomUUID();
    const until = Date.now() + this.timeoutMs;
    const res = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify([runwareImageTask(this.model, taskUUID, prompt, this.side, refs)]),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const j = (await res.json().catch(() => ({}))) as { data?: { imageURL?: string; status?: string; cost?: number }[]; errors?: unknown[] };
    if (j.data?.[0]?.imageURL) meterRunware(this.model, [j.data[0]]);
    const processing = !j.errors?.length && j.data?.[0] && !j.data[0].imageURL;
    const url = j.data?.[0]?.imageURL ?? (processing ? await this.waitFor(taskUUID, until) : undefined);
    if ((!res.ok && !url) || j.errors?.length || !url) throw new Error(`${this.name} ${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 200)}`);
    const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new Error(`${this.name} image ${img.status}`);
    return { data: Buffer.from(await img.arrayBuffer()), mime: 'image/jpeg' };
  }
}

/** Seedream 5.0 Pro on Runware (the R16 painter of the looks and the Bati) */
export class SeedreamImageProvider extends RunwareImageProvider {
  constructor(apiKey: string, side = 1024, maxAtOnce = 12, timeoutMs = 115_000) {
    super(apiKey, side, maxAtOnce, timeoutMs, SEEDREAM_MODEL);
  }
}

/** The looks and the Bati: Seedream when its key is set, else the general image provider. */
export function createLookImageProvider(cfg: { runwareKey?: string; geminiApiKey?: string; imageModel?: string }): ImageProvider {
  return cfg.runwareKey ? new SeedreamImageProvider(cfg.runwareKey) : createImageProvider(cfg);
}

/**
 * R17: the painter of one picture use from its config — a Gemini image model (gemini-…) on the Gemini key, anything else
 * a Runware AIR id on the Runware key. A Runware model without the Runware key falls back to Gemini (then the mock).
 */
export function createPictureProvider(model: string, keys: { runwareKey?: string; geminiApiKey?: string }): ImageProvider {
  const m = model.trim();
  if (!/^gemini/i.test(m) && keys.runwareKey) return new RunwareImageProvider(keys.runwareKey, 1024, 12, 115_000, m);
  return createImageProvider({ geminiApiKey: keys.geminiApiKey, imageModel: /^gemini/i.test(m) ? m : undefined });
}

export function createImageProvider(cfg: { geminiApiKey?: string; imageModel?: string }): ImageProvider {
  return cfg.geminiApiKey ? new GeminiImageProvider(cfg.geminiApiKey, cfg.imageModel || 'gemini-2.5-flash-image') : new MockImageProvider();
}

const STYLE =
  'Illustration in the style of a dark-fantasy anime mascot game: richly detailed, cute but mysterious, soft cinematic lighting, ' +
  'single character, full body, centered, facing the viewer, on a deep starry night-sky background with a faint glow. ' +
  'Square image. No text, no letters, no logo, no watermark.';

/**
 * The OBOLO NEO look (client decision 2026-10-25): one house style for everyone — a semi-real portrait in an
 * oversized, mysterious secret-society hood, the chosen animal's ears through the hood, the chosen colours
 * in the hood, the hair or the ears, and round gold-rimmed sunglasses that always hide the eyes (so anyone
 * can feel it is them; the second rule: here you change your look). Four pictures: two boyish, two girlish
 * (gender is never asked), each with the colours placed differently; skin tones vary for people everywhere.
 */
const WHO_DEFAULT = 'a young person in their late teens';
/**
 * M-R173 (client decision): the touch is Japanese anime, never American-looking (no western cartoon, comic or 3D faces).
 * Two of the four in a Japanese anime-style semi-real, two as a more character-like anime picture; a boyish and a
 * girlish one in each (LEAN alternates). No artist, studio or title names.
 */
const TOUCH_SEMI =
  'Japanese anime-style semi-realistic illustration, modern Japanese anime key-visual look, clean fine line art, soft cel shading with gentle painterly ' +
  'light, Japanese character design, painted skin and hair — NOT a photograph, no photographic skin texture, no camera depth of field.'
const TOUCH_ANIME =
  'Japanese anime character illustration, bold clean outlines, flat cel shading, simplified anime facial features, vivid colours — NOT a photograph.'
/** client 2026-11-22: the four looks are four different touches of the same character */
const TOUCH_WATERCOLOR =
  'Soft watercolour illustration in a Japanese picture-book manner, delicate ink line art, transparent washes, gentle paper texture, painted skin and hair — NOT a photograph.';
const TOUCH_POSTER =
  'Stylish Japanese graphic illustration, crisp vector-like line art, flat bold shapes with limited rich colours and subtle gradients, like a modern anime poster — NOT a photograph.';
const TOUCHES = [TOUCH_SEMI, TOUCH_ANIME, TOUCH_WATERCOLOR, TOUCH_POSTER];
const NOT_WESTERN = 'Avoid: western cartoon, american comic style, 3D render, pixar style, photorealistic.'
const LOOK_STYLE =
  TOUCH_SEMI +
  ' Chest-up, centered, facing the viewer, ' + WHO_DEFAULT + ' with a friendly, attractive face. A member of a mysterious secret society: an OVERSIZED, deep, mysterious hooded cloak, the big hood ' +
  "pulled up over the head and falling loosely around the shoulders, its edge casting a soft shadow, fine gold embroidery along the hood's edge. " +
  'Round sunglasses with thin gold frames and pitch-black lenses with a faint golden reflection are always worn: the eyes are never visible. ' +
  'The mouth and the lower face are visible (no face mask, no scarf over the mouth). Modest clothes under the cloak with a high closed neckline, nothing revealing. ' +
  'Background: a dark night with soft golden glints and faint stars, softly blurred. Square image that works as a round profile icon (the face in ' +
  'the middle). Safe for children. No text, no letters, no logo, no watermark.';
const LEAN = ['The character reads as a boy.', 'The character reads as a girl.'];

/**
 * M-R172 (client decision): the look is drawn for the visitor's age band, from the birth year asked on Day 1 — the
 * painter only ever gets the band. Under 15 as young as they are (no makeup, nothing grown-up); 15-24 as they are;
 * 25 and over youthful (no signs of ageing, about the late twenties at most), never childlike, the photo's likeness kept.
 */
const AGE: Record<'under15' | '15-24' | '25plus', { who: string; line: string }> = {
  under15: {
    who: 'a young teenager',
    line: 'Age: a young teenager, wholesome and as young as they are: no makeup, age-appropriate clothes, no grown-up body or styling.',
  },
  '15-24': { who: 'a young person in their late teens or early twenties', line: 'Age: as they are, in their late teens or early twenties.' },
  '25plus': {
    who: 'a youthful-looking adult who appears in their mid-to-late twenties',
    line:
      'Age: a youthful-looking adult, appears in the mid-to-late twenties, smooth healthy skin; no wrinkles, no smile lines, no under-eye bags, no age spots, ' +
      'no grey or thinning hair; keep the face shape, hairstyle and vibe of the photo; not childlike. Avoid: wrinkles, aged skin, grey hair.',
  },
};
/** the touch of the n-th of the four (client 2026-11-22): semi-real anime, cel anime, watercolour, graphic poster; the look's other lines untouched */
export function withTouch(prompt: string, variant: number): string {
  const touch = TOUCHES[((variant % 4) + 4) % 4];
  return `${prompt.replace(TOUCH_SEMI, touch)} ${NOT_WESTERN}`;
}

export function withAgeBand(prompt: string, band: 'under15' | '15-24' | '25plus' | null | undefined): string {
  if (!band) return prompt;
  return `${prompt.replace(WHO_DEFAULT, AGE[band].who)} ${AGE[band].line}`;
}
const SKIN = ['fair skin', 'light olive skin', 'warm brown skin', 'deep brown skin', 'light tan skin', 'golden-beige skin'];
const EARS: Record<string, string> = {
  犬: 'soft dog ears',
  猫: 'cat ears',
  狐: 'tall pointed fox ears',
  うさぎ: 'long rabbit ears',
  くま: 'small round bear ears',
  鳥: 'feathered ear tufts like a small bird',
  竜: 'small curved dragon horns and fin-shaped dragon ears',
};
const OMAKASE_EARS = Object.values(EARS);
const MOOD: Record<string, string> = {
  かっこいい: 'brave, heroic and cool',
  かわいい: 'sweet, cute and gentle',
  クール: 'calm, cool and composed',
  パーティーが好き: 'playful, cheerful and festive',
};
const OMAKASE_COLOURS = ['deep blue and silver', 'crimson and gold', 'violet and white', 'emerald and black', 'warm orange and cream', 'soft pink and white'];
const any = (v: string | undefined, d: string) => (!v || /おまかせ/.test(v) ? d : v);
const pick = <T>(xs: T[], k: number) => xs[((k % xs.length) + xs.length) % xs.length];
/** where the two colours go, one way per picture */
const PLACE = [
  (a: string, b: string) => `the hood and cloak are ${a}, the hair is ${b}`,
  (a: string, b: string) => `the hair is ${a}, the animal ears are ${b}, the hood is dark with ${a} lining`,
  (a: string, b: string) => `the hood and cloak are ${a}, the inner fur of the ears and the tips of the hair are ${b}`,
  (a: string, b: string) => `the hood is ${b} with ${a} trim, the hair and the ears are ${a}`,
];
/** from a photo the hair keeps its own colour (test 1, A: blond and teal hair lost the likeness): the colours go on the cloth */
const PHOTO_PLACE = [
  (a: string, b: string) => `the hood and cloak are ${a}, the lining is ${b}`,
  (a: string, b: string) => `the hood is dark with ${a} lining, the inner fur of the animal ears is ${b}`,
  (a: string, b: string) => `the hood and cloak are ${a}, the embroidered trim and the ear fur are ${b}`,
  (a: string, b: string) => `the hood is ${b} with ${a} trim, the animal ears are ${a}`,
];
const photoColours = (c: string | undefined, variant: number) => {
  const [a, b] = any(c, pick(OMAKASE_COLOURS, variant)).split(/と|and|,|、/).map((x) => x.trim()).filter(Boolean);
  return PHOTO_PLACE[variant % PHOTO_PLACE.length](a, b ?? a);
};
const who = (variant: number, round = 0) => `${LEAN[variant % 2]} The character has ${pick(SKIN, variant * 2 + round * 3)}.`;
const colours = (c: string | undefined, variant: number) => {
  const [a, b] = any(c, pick(OMAKASE_COLOURS, variant)).split(/と|and|,|、/).map((x) => x.trim()).filter(Boolean);
  return PLACE[variant % PLACE.length](a, b ?? a);
};
const ears = (animal: string | undefined, variant: number) => {
  const a = any(animal, '');
  return a ? (EARS[a] ?? `the ears of a ${a}`) : pick(OMAKASE_EARS, variant + Date.now());
};

/** Day 2: OBOLON's questions (animal, colours, mood, what they are into). */
export function neoLookPrompt(a: { animal: string; color: string; mood: string; hobby?: string }, variant: number, round = 0): string {
  const hobby = a.hobby && !/パス/.test(a.hobby) ? ` They love ${a.hobby}: show it as one small charm or accent they wear.` : '';
  const mood = MOOD[a.mood] ?? any(a.mood, 'mysterious and kind');
  return `${LOOK_STYLE} ${capital(ears(a.animal, variant))} come out through openings in the hood. Mood and expression: ${mood}. Colours: ${colours(a.color, variant)}.${hobby} ${who(variant, round)} ${ORIGINAL}`;
}

/**
 * M-R250: under 13 (or 13〜15 without the guardian's consent) — no photo: the chosen animal itself as the character, wearing
 * the society's hood and the round gold-rimmed sunglasses (eyes never shown). The four differ in their touch (withTouch).
 */
export function neoAnimalPrompt(a: { animal: string; color: string; mood: string }, variant: number): string {
  const animal = any(a.animal, 'fox');
  const mood = MOOD[a.mood] ?? any(a.mood, 'mysterious and kind');
  const pose = ['a gentle smile', 'a confident little grin', 'a calm, cool look', 'a cheerful open smile'];
  return `A cute, friendly ${animal} character (the animal itself, standing like a person, not a human with animal ears), chest-up, centered, facing the viewer. A member of a mysterious secret society: an oversized, deep hooded cloak, the big hood pulled up over its head with its ears coming out through openings, fine gold embroidery along the hood's edge. It wears round sunglasses with thin gold frames and pitch-black lenses, so its eyes are not visible. Colours: ${colours(a.color, variant)}. Mood: ${mood}; ${pick(pose, variant)}. Plain soft background. ${ORIGINAL}`;
}

/**
 * Day 2 from a favourite photo of themselves (M-R148): the person in the photo drawn semi-real — their face
 * shape, hairstyle and hair colour kept as a likeness — with the chosen animal's ears, the society's hood in the
 * chosen colours and the round gold-rimmed sunglasses (the eyes never shown). The four differ in the ears, how the
 * hood is worn and the expression. The photo is only handed to the painter (never stored).
 */
export function neoFromPhotoPrompt(a: { animal: string; color: string; mood: string; hobby?: string }, variant: number): string {
  const hobby = a.hobby && !/パス/.test(a.hobby) ? ` They love ${a.hobby}: show it as one small charm or accent they wear.` : '';
  const mood = MOOD[a.mood] ?? any(a.mood, 'mysterious and kind');
  const hood = ['the hood pulled up deep', 'the hood up but pushed back a little', 'the hood up, slightly tilted', 'the hood up with the edge framing the face'];
  const face = ['a gentle smile', 'a confident little grin', 'a calm, cool expression', 'a cheerful open smile'];
  return `Paint, do not photograph: turn the person in the attached photo into a painted illustration (brush strokes, painted skin and hair), never a retouched photo. ${LOOK_STYLE} Base the character on the person in the attached photo: draw THEM as a semi-real painted portrait, keeping a clear likeness of their face shape, hairstyle and their own hair colour (painted and flattering). They wear round sunglasses with thin gold frames and pitch-black lenses, so their eyes are not visible. ${capital(ears(a.animal, variant))} come out through openings in the hood, ${pick(hood, variant)}. Colours: ${photoColours(a.color, variant)}; the hair keeps the photo's own colour. Mood: ${mood}; ${pick(face, variant)}.${hobby} Only this one person, never anyone else from the photo.`;
}

/** Day 2: in the visitor's own words (the hood and the sunglasses stay). */
export function neoWordsPrompt(words: string, variant: number, round = 0): string {
  return `${LOOK_STYLE} The visitor describes the look they want in their own words: "${words}". Follow it closely, within the hood and sunglasses style. ${who(variant, round)} ${ORIGINAL}`;
}

/** Day 2: おまかせ. */
export function neoOmakasePrompt(variant: number, round = 0): string {
  return `${LOOK_STYLE} ${capital(pick(OMAKASE_EARS, variant * 3 + round))} come out through openings in the hood. Colours: ${colours(undefined, variant + round)}. Make it charming and surprising. ${who(variant, round)} ${ORIGINAL}`;
}

/** "この感じで、もっと見る": four new looks close to the attached one. */
export function neoMorePrompt(variant: number): string {
  return `${LOOK_STYLE} Draw a new variation of the character in the attached image: keep its feel, animal ears, colours and art style, but change details (expression, the angle of the head, small accessories, hair). ${ORIGINAL}`;
}

/**
 * The one refine (client decision 2026-10-25): the visitor picks the closest of the four and says what to
 * change → four pictures with the request, clearly the same person, a little different from each other.
 */
export function refineLookPrompt(instruction: string, variant = 0): string {
  const ways = ['a gentle smile', 'a confident look', 'the head tilted a little', 'a calm expression, the face turned slightly'];
  return `Edit the attached character portrait following this request: "${instruction}". Keep the same character identity, the oversized hood, the animal ears, the round gold-rimmed sunglasses hiding the eyes, the colours, the art style, the framing and the background. Variation ${variant + 1} of 4: ${pick(ways, variant)}. No text, no letters. ${ORIGINAL}`;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Jupiter (first journey): Bati draws a sticker's picture from its words (a round sticker, no letters). */
export function stickerArtPrompt(words: string, style?: string): string {
  // Jupiter's art (M-R151): one square picture that fills the frame; the touch is the one said to {bati}
  return (
    'One square artwork that fills the whole square frame edge to edge (no border, no frame, no sticker outline). ' +
    (style ? `Style and touch: ${style}. ` : 'Style: warm, soft hand-painted storybook illustration, gentle colours. ') +
    `It shows this feeling or moment: "${words}". ` +
    'No text, no letters, no numbers, no logo, no watermark. Do not draw real people or their faces.'
  );
}

/**
 * The newborn Bati (client decision 2026-10-25): the egg holds one of eight prepared body types (no misses —
 * apps/api/assets/bati/<egg>-<n>.jpg, painted on flat grey and put on the key colour before the edit); the favourite food is mixed into that body.
 * Without the body picture (no file), the old free drawing.
 */
const FOOD_PARTS: [RegExp, string][] = [
  [/おにぎり|おむすび/, 'a triangular rice-ball head shape, a black nori seaweed band worn like a bib or a scarf, one red umeboshi dot'],
  [/たこ焼/, 'round takoyaki balls, glossy brown sauce, white mayonnaise stripes, green aonori flakes and pink katsuobushi flakes like hair'],
  [/ラーメン/, 'wavy yellow noodle hair, a pink-and-white naruto swirl mark, half a boiled egg, a nori sheet'],
  [/いちご|苺/, 'a red body with tiny yellow seeds, a green strawberry calyx worn as a hat'],
  [/プリン/, 'a wobbly yellow custard body with a dark caramel top and a red cherry'],
  [/とうもろこし|コーン/, 'yellow corn kernels, silky corn tassel hair, green husk leaves like little wings'],
  [/カレー/, 'a warm curry-brown colour, a white rice cap, little orange carrot and yellow potato pieces as accessories'],
  [/すし|寿司/, 'a sushi rice body with a fish slice on top and a nori band'],
  [/ケーキ/, 'cream frosting, a strawberry on top, sponge-cake layers'],
  [/ドーナツ/, 'a ring-shaped donut tail, pink icing and colourful sprinkles'],
  [/うんち/, 'a cute soft-serve swirl shape on its head, golden brown and shiny, sparkles (cute, never dirty)'],
];
/** the parts that tell the food at a glance, for the foods asked most; any other food: its own most recognisable parts */
export function foodParts(food: string): string {
  return FOOD_PARTS.find(([r]) => r.test(food))?.[1] ?? `the two or three most recognisable parts of "${food}" that a child would know at a glance`;
}

/** what a {bati} was born from (M-R218): the first from a favourite food, the second a favourite sound, the third a word */
export type BatiSeedKind = 'food' | 'sound' | 'word';
export interface BatiSeed {
  seed: string;
  kind?: BatiSeedKind;
}

/**
 * M-R223: whatever the look, the seed it was born from stays somewhere small — the food as a hair ornament, a pattern or
 * something it holds (a small tattoo of it when that would look odd); a favourite sound as a small motif of that sound
 * (a waveform, notes, the thing that makes it); a word as its letters, small. Put into every painting of {bati}.
 */
export function batiSeedRule(s: BatiSeed | null | undefined): string {
  const seed = s?.seed?.trim();
  if (!seed) return '';
  const kind = s?.kind ?? 'food';
  if (kind === 'sound')
    return (
      `IMPORTANT: it was born from the favourite sound "${seed}", and a small trace of that sound must stay visible somewhere on it in every look: ` +
      'a small sound-pattern motif that evokes it (a little waveform, musical notes, ripples, or a tiny version of the thing that makes the sound) ' +
      'as a hair ornament, a pattern on its body or clothes, or something it holds — small, not the main subject. If that would look unnatural, a ' +
      'small tattoo of that sound motif somewhere on its body.'
    );
  if (kind === 'word')
    return (
      `IMPORTANT: it was born from the word "${seed}", and that word must stay visible somewhere small on it in every look: the word's own letters, ` +
      'written exactly as given, as a small motif — a charm, a badge, an embroidered pattern or something it holds (this is the only text allowed in ' +
      'the picture). If that would look unnatural, a small tattoo of the word somewhere on its body.'
    );
  return (
    `IMPORTANT: it was born from the food "${seed}", and a little of that food must stay visible somewhere on it in every look: a small hair ` +
    `ornament, a pattern or an item it holds that is clearly "${seed}" (${foodParts(seed)}) — small, not the main subject. If that would look ` +
    `unnatural, a small tattoo of "${seed}" somewhere on its body.`
  );
}

/**
 * The flat background a picture that is cut out is painted on (cut-out review 2026-11-23): a pure key colour chosen
 * far from the character's own colours (apps/api/src/media/keying.ts chooseKey), never the mid-grey of before — grey
 * shading, white masks and silver were eaten by it and its fringe stayed. `key` is the words for the colour, e.g.
 * "pure chroma-key green (#00FF00)".
 */
export const DEFAULT_KEY_WORDS = 'pure chroma-key green (#00FF00)';
export const keyedBackground = (key: string = DEFAULT_KEY_WORDS) =>
  `a perfectly flat, solid ${key} background — one single even colour everywhere around it, also in the gaps — with no floor, no shadow, no light spill and no other objects; nothing on the character is that colour`;

export function batiPrompt(food: string, fromBody = false, kind: BatiSeedKind = 'food', key: string = DEFAULT_KEY_WORDS): string {
  // M-R218 / M-R223: a {bati} born from a sound or a word carries it as a small motif (the body is restyled like the food's)
  if (kind !== 'food') {
    const motif = batiSeedRule({ seed: food, kind });
    if (fromBody)
      return (
        "Edit the first picture: keep the creature's body shape, silhouette, pose, size, framing, face and eyes exactly the same, on " + keyedBackground(key) + '. ' +
        `Restyle its colours, patterns and small accessories so it is clearly inspired by ${kind === 'sound' ? 'the sound' : 'the word'} "${food}" and the mood it gives. ` +
        'It stays a cute, friendly creature, never scary. Keep the tiny mark on its forehead. ' +
        motif
      );
    return `${STYLE} The character is a newborn magical partner creature called Bati: small, round and chubby, with big sparkling eyes, whose colors and accessories are inspired by ${kind === 'sound' ? 'the sound' : 'the word'} "${food}". It looks friendly and happy, as if it just hatched from an egg (a few eggshell pieces nearby). ${motif}`;
  }
  if (fromBody)
    return (
      "Edit the first picture: keep the creature's body shape, silhouette, pose, size, framing, face and eyes exactly the same, on " + keyedBackground(key) + '. ' +
      `Restyle its colours, patterns and small accessories so it is clearly inspired by "${food}": the food's colours become its colours, and small parts of the food ` +
      'become a little hat, ear tips, tufts, cheeks or the tip of its tail. Its skin or fur stays soft, smooth and clean (no raw food texture all over the body, ' +
      `no meat on its skin). The food's signature parts must be clearly visible: ${foodParts(food)}. ` +
      'It stays a cute, appetising creature, not a plate of food, never scary. Keep the tiny mark on its forehead. No text, no letters.'
    );
  return `${STYLE} The character is a newborn magical partner creature called Bati: small, round and chubby, with big sparkling eyes, whose body, colors and accessories are inspired by "${food}". It looks friendly and happy, as if it just hatched from an egg (a few eggshell pieces nearby).`;
}

/**
 * Bati's room (P-BATI-ROOM): the hatched Bati, on its flat key colour, dressed up or changed a little by the member's wish —
 * clothes, accessories, a small transformation — and still clearly the same creature. Three variations per round.
 */
/**
 * The look's rules for every painting of {bati} (M-R215): free per child, but never a real person's lookalike, another
 * work's character, a sexual or a violent look. The wish is screened before (moderateLookWish); these say it again.
 */
export const BATI_LOOK_RULES =
  'Rules for the look: it must not resemble any real, existing person; it must not resemble or copy any character, mascot, costume, ' +
  'logo or brand from an existing anime, game, film, book or company; nothing sexual or revealing; nothing violent (no weapons, blood ' +
  'or injuries). Cute and kids-friendly, never scary.';

/**
 * `withOriginal`: the {bati} as it was born is attached as the second picture, so the creature does not drift away
 * over many dress-ups (M-R215: the current look is the reference, the birth's picture keeps who it is).
 */
/**
 * M-R223 (D03-S008): asked without a wish, the four cards are the {bati} now in four art touches (the script's アニメ風・
 * ゆるキャラ風・3D風・ドット絵風, BATI_RESTYLE_TOUCHES in @obolo/shared, same order).
 */
export const BATI_RESTYLE_TOUCH_WORDS = [
  'Japanese anime style: clean line art, cel shading, big expressive anime eyes, vivid colours',
  'Japanese yuru-chara mascot style: very simple rounded shapes, thick soft outlines, flat pastel colours, a gentle goofy charm',
  'cute 3D style: a soft rounded 3D render like a vinyl toy figure, smooth materials, soft studio light (still on the same flat background)',
  'pixel art style: a crisp 32-bit pixel-art sprite with a limited palette and visible square pixels (still on the same flat background)',
] as const;

export function batiRestylePrompt(wish: string, variant = 0, withOriginal = false, seed?: BatiSeed | null, key: string = DEFAULT_KEY_WORDS): string {
  const ways = ['a happy pose', 'a proud little pose, showing off the new look', 'a playful pose, turning a little', 'a cheerful little jump'];
  const w = wish.trim();
  const change = w
    ? `Dress it up or change it following this wish: "${w}" — new clothes, accessories, a hat, a small costume, a different art ` +
      'touch (watercolour, crayon, pixel art …) or a cute transformation (colours of a part, little wings, a tail tip, ears), never a ' +
      'different animal or a different character. ' +
      `Variation ${variant + 1} of 4 (each of the four a clearly different take on the wish): ${pick(ways, variant)}. `
    : `Redraw it in a different art touch, keeping who it is: ${pick([...BATI_RESTYLE_TOUCH_WORDS], variant)}. ${pick(ways, variant)}. `;
  return (
    'Edit the first picture: it is the same small magical partner creature called Bati — its look now, the reference to follow — and it must ' +
    'stay clearly the same creature: the same face, eyes, body shape, main colours, the tiny mark on its forehead and the framing, on ' +
    keyedBackground(key) +
    '. ' +
    (withOriginal ? 'The second picture is the same creature as it was born: keep its identity (face, eyes, body shape) from it. ' : '') +
    change +
    (seed?.kind === 'word' ? 'No other text, no other letters. ' : 'No text, no letters. ') +
    BATI_LOOK_RULES +
    (seed ? ` ${batiSeedRule(seed)}` : '')
  );
}

const ORIGINAL =
  'IMPORTANT: the result must be a completely NEW, ORIGINAL character. Do NOT reproduce, trace or imitate any existing ' +
  'character, mascot, costume, logo or trademark from anime, games, films or brands; change the face, outfit design, ' +
  'silhouette and details so it is clearly a different character.';

/**
 * Day 3 (client decision 2026-10-05): start from a reference image the visitor likes. KIMORIN asks
 * which part they love (`liked`) and what twist makes it theirs (`twist`), so only elements are taken.
 */
export function neoFromReferencePrompt(a: { liked?: string; twist?: string }, variant: number): string {
  const liked = a.liked ? `ONLY as loose inspiration for this element: "${a.liked}"` : 'ONLY as loose inspiration (colours, motifs, mood)';
  const twist = a.twist ? ` Add this personal twist: "${a.twist}".` : '';
  return `${LOOK_STYLE} Use the attached image ${liked}. ${ORIGINAL}${twist} ${who(variant)}`;
}


/**
 * Saturn picture character (client decision 2026-10-07): a round, glossy "mochi" mascot in the
 * style of the attached style sheet (the client's reference characters). Plain white background
 * so the server can cut it out. The body must be one round ball filling the frame — it is warped
 * as a soft body in the app.
 */
/**
 * Jupiter butterfly (client request 2026-10-07: new art is made with Gemini): a cute chibi
 * character with butterfly wings holding a round sticker book, in the style of the client's
 * パタパタ butterflies (style sheet).
 */
export function butterflyPrompt(description: string, hasReference: boolean, variant: number): string {
  const moods = ['happy and smiling', 'calm and gentle', 'proud and cheerful', 'shy with a soft smile'];
  return (
    'Draw ONE cute chibi character with butterfly wings, in exactly the art style of the FIRST attached image (the style sheet): ' +
    'soft hand-painted storybook illustration, warm muted colours, a round chubby little body standing upright, a big head, ' +
    'small shiny eyes, pink blush, two curly antennae on top, and two big rounded butterfly wings spread behind the body with ' +
    'pretty patterns that match the character (flowers, moons, stars, swirls). Outfit and accessories match the concept. ' +
    'The character hugs a ROUND sticker book (a round album with ring binding on the left and a small clasp on the right) in ' +
    'front of its belly with both hands, decorated to match the character, exactly like every character on the style sheet. ' +
    `Character concept: "${description}". Mood: ${moods[variant % moods.length]}. ` +
    (hasReference ? 'Use the SECOND attached image as the character to turn into this butterfly (keep its colours, face and motifs). ' : '') +
    'Composition: front view, the whole character and both wings fully visible and centered, filling about 85% of a square frame. ' +
    'Background: plain flat pure white (#FFFFFF), no ground, no shadow, no other objects. No text, no letters, no logo, no watermark. ' +
    ORIGINAL
  );
}

/**
 * Saturn's kororin (M-R153, client 2026-11-01: they came out as round mochi mascots): always a squishy takoyaki ball
 * in the style of the FIRST attached image (the base kororin), its body never changes; the member's words become its
 * colours, patterns, the band around its lower body and a small charm. Sunglasses up on the forehead, eyes visible.
 */
export function kororinPicPrompt(description: string, hasReference: boolean, variant: number): string {
  const moods = ['happy and smiling', 'cheerful with a tiny wink feel', 'calm and gentle', 'excited'];
  return (
    'Draw ONE kororin character in exactly the style of the FIRST attached image (the base kororin): a small squishy takoyaki ball ' +
    '(round octopus dumpling) with a golden-brown baked body, brown takoyaki sauce on top, a white mayonnaise zigzag, green aonori flakes ' +
    'and dancing katsuobushi flakes, small black dot eyes, a tiny "ω" mouth, short stubby arms and feet, a soft soft-lit deformed 3D look. ' +
    'Round gold-rimmed sunglasses are pushed UP on its forehead, resting on the sauce, so the eyes stay visible. The body is ALWAYS this takoyaki ball. ' +
    `Make it the member's own from their words: "${description}" — show it only as the colour of the band around its lower body, small patterns, ` +
    `and one small charm or accessory it wears or holds. Mood: ${moods[variant % moods.length]}. ` +
    (hasReference ? 'Use the SECOND attached image only for a hint of colours and motifs (never its face or body). ' : '') +
    'Composition: full body, front view, centered, about 75% of a square frame, nothing cut off. ' +
    'Background: plain flat pure white (#FFFFFF), no ground, no shadow, no other objects. No text, no letters, no logo, no watermark. ' +
    ORIGINAL
  );
}

export function puniPicPrompt(description: string, hasReference: boolean, variant: number): string {
  const moods = ['happy and smiling', 'cheerful with a tiny wink feel', 'sleepy and calm', 'excited'];
  const shades = ['thin gold frames with dark lenses', 'thick black frames with pink-tinted lenses', 'white frames with mirrored blue lenses', 'tortoiseshell frames with amber lenses'];
  return (
    'Draw ONE cute kawaii mascot character in exactly the art style of the FIRST attached image (the style sheet): ' +
    'a round, glossy, mochi-like ball body that is almost a perfect circle, soft pastel digital painting, a big soft highlight ' +
    'on the upper left, gentle shading, small shiny dark eyes with white sparkles, a tiny "ω" cat mouth, pink blush on the cheeks, ' +
    'tiny stubby arms and feet that stay close to the body. Accessories and patterns are painted ON or tightly around the round body. ' +
    `Character concept: "${description}". Mood: ${moods[variant % moods.length]}. ` +
    // M-R153: every kororin keeps round sunglasses pushed up on its forehead (they drop onto the eyes when it sings)
    `It wears small round sunglasses pushed UP on its forehead, above the eyes (the eyes stay visible): ${shades[variant % shades.length]}. ` +
    (hasReference ? 'Use the SECOND attached image only as loose inspiration for colours and motifs, turned into this round mascot. ' : '') +
    'Composition: the round body is centered and fills about 80% of a square frame, front view, nothing cut off. ' +
    'Background: plain flat pure white (#FFFFFF), no ground, no shadow, no other objects. No text, no letters, no logo, no watermark. ' +
    ORIGINAL
  );
}

/**
 * A picture {bati} draws in the chat (M-R208: "〜の絵を見せて"): one child-safe illustration of what was asked, from
 * the English description the chat's sorting wrote (moderated before it is painted).
 */
export function batiChatPicturePrompt(description: string): string {
  return (
    'One square, child-friendly illustration for a children\'s app, warm and gentle, clear and easy to understand at a glance. ' +
    `It shows: ${description.replace(/["\n]/g, ' ').slice(0, 200)}. ` +
    'Soft hand-painted storybook style, bright friendly colours. Nothing scary, violent or grown-up. ' +
    'No text, no letters, no numbers, no logo, no watermark. Do not draw real people or their faces.'
  );
}
