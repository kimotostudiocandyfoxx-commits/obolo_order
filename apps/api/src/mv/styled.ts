import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { StoryPlan, StoryScene } from './storyboard';

/**
 * Two-look story MV (client decision 2026-10-11, "B"): the verses are cheap, deliberately different
 * chibi / crayon cuts (Animagine XL on Runware, ~0.3 yen a picture), the chorus is two Seedream 5.0
 * Pro key visuals drawn from the hero's own picture (~7 yen each) cut on the bars. The change of
 * look follows the song, like an anime opening where the art goes all-out on the chorus.
 * Runware: one key for both (secret obolo-seedream-api-key), no GPU of our own to wake up.
 */
export type Tier = 'chibi' | 'key';
const log = new Logger('MvStyled');
const API = 'https://api.runware.ai/v1';

export const SEEDREAM = 'bytedance:seedream@5.0-pro';
/**
 * A picture model that reads reference pictures (Model scout s02, 2026-10-12, Runware's own cost):
 * Seedream 5.0 Pro ~9 yen a picture; FLUX.2 [klein] 4B 0.19 yen, 9B 0.37 yen; Qwen-Image 2.1 Turbo
 * 2.1 yen — all kept KIMORIN. `single` / `sheet` = picture sizes (one scene / a 2x2 sheet).
 */
export type Painter = { model: string; single: number; sheet: number; maxRefs: number };
export const SEEDREAM_PAINTER: Painter = { model: SEEDREAM, single: 1536, sheet: 1536, maxRefs: 10 };
export const PAINTERS: Record<string, Painter> = {
  seedream: SEEDREAM_PAINTER,
  'klein-4b': { model: 'runware:400@4', single: 1024, sheet: 1440, maxRefs: 4 },
  'klein-9b': { model: 'runware:400@2', single: 1024, sheet: 1440, maxRefs: 4 },
  'qwen-turbo': { model: 'alibaba:qwen-image@2.1-turbo', single: 1024, sheet: 1440, maxRefs: 3 },
};
/** found once with Runware's modelSearch when not given (MV_CHIBI_MODEL) */
const CHIBI_SEARCH = 'Animagine XL 4.0';
// MV lab m06: "super deformed" alone gave wallpaper collages of many faces and spiky mecha looks →
// one small round character, full body, soft crayon picture-book look
// m07: "simple background" left empty pictures → a soft crayon background that shows the place
const CHIBI_LOOK = 'solo, one character, chibi, full body, small round body, cute, soft crayon drawing, picture book illustration, pastel colours, soft outlines, detailed soft crayon background showing the place, masterpiece, high score';
const CHIBI_NEGATIVE =
  'multiple views, collage, pattern, wallpaper, repeated, many faces, character sheet, comic panels, spiky, armor, mecha, angular, realistic, 3d, photo, lowres, bad anatomy, text, watermark, signature, nsfw, nude, sensitive, explicit, 1girl, 1boy, human, person, crowd, worst quality, low quality';
/** Runware's IP-Adapter for SDXL: the chibi cuts look at the hero's own picture too */
const IP_ADAPTER = process.env.MV_CHIBI_IP_ADAPTER || 'runware:55@1';

type RunwareImage = { taskUUID?: string; imageURL?: string; imageBase64Data?: string; cost?: number };

export class StyledPainter {
  private chibiModel?: string;
  /** what the last paint cost in USD (Runware reports it per picture) */
  lastCostUsd = 0;
  constructor(private readonly o: { key: string; chibiModel?: string; side?: number }) {
    this.chibiModel = o.chibiModel;
  }

  private async call(tasks: Record<string, unknown>[], timeoutMs = 240_000): Promise<RunwareImage[]> {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.o.key}` },
      body: JSON.stringify(tasks),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = (await res.json().catch(() => ({}))) as { data?: RunwareImage[]; errors?: { message?: string; code?: string }[] };
    if (!res.ok || (j.errors?.length && !j.data?.length)) throw new Error(`runware ${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
    for (const e of j.errors ?? []) log.warn(`runware: ${e.code} ${e.message}`);
    return j.data ?? [];
  }

  /** Some imageInference tasks, their pictures in the same order (null where one failed). */
  /** (adds to lastCostUsd; the caller resets it) */
  async run(tasks: Record<string, unknown>[]): Promise<(Buffer | null)[]> {
    const ids = tasks.map((t) => String(t.taskUUID));
    // a few at a time (Runware's per-request limits); each failure only loses its own picture
    const out: (Buffer | null)[] = [];
    for (let i = 0; i < tasks.length; i += 5) {
      const part = tasks.slice(i, i + 5);
      const images = await this.call(part, 300_000).catch((e) => {
        log.warn(`runware: ${String(e).slice(0, 300)}`);
        return [] as RunwareImage[];
      });
      out.push(...(await this.fetchAll(images, ids.slice(i, i + 5))));
    }
    return out;
  }

  /** The Animagine model's AIR id on Runware (searched once). */
  async chibi(): Promise<string> {
    if (this.chibiModel) return this.chibiModel;
    const found = (await this.call([{ taskType: 'modelSearch', taskUUID: randomUUID(), search: CHIBI_SEARCH, category: 'checkpoint', architecture: 'sdxl', limit: 10 }], 30_000)) as unknown as {
      results?: { air?: string; name?: string; version?: string; downloadCount?: number }[];
    }[];
    const list = found.flatMap((f) => f.results ?? []);
    const pick = list.find((m) => /animagine/i.test(`${m.name}`) && /4\.0/.test(`${m.name} ${m.version}`) && /opt/i.test(`${m.name} ${m.version}`)) ?? list.find((m) => /animagine/i.test(`${m.name}`));
    if (!pick?.air) throw new Error(`no Animagine model on Runware (${list.map((m) => m.name).join(', ')})`);
    log.log(`chibi model: ${pick.name} ${pick.version ?? ''} → ${pick.air}`);
    this.chibiModel = pick.air;
    return pick.air;
  }

  private async fetchAll(images: RunwareImage[], order: string[]): Promise<(Buffer | null)[]> {
    const byId = new Map(images.map((im) => [im.taskUUID, im]));
    return Promise.all(
      order.map(async (id) => {
        const im = byId.get(id);
        this.lastCostUsd += im?.cost ?? 0;
        if (!im?.imageURL) return null;
        const r = await fetch(im.imageURL, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
        return r?.ok ? Buffer.from(await r.arrayBuffer()) : null;
      }),
    );
  }

  /** The scenes in order: chibi ones in one Runware call, the key visuals in another (in parallel). */
  async paint(scenes: (StoryScene & { tier: Tier })[], heroLook: string, reference: Buffer | null, seed: number): Promise<(Buffer | null)[]> {
    this.lastCostUsd = 0;
    const side = this.o.side ?? 1024;
    const out: (Buffer | null)[] = scenes.map(() => null);
    const chibiIdx = scenes.map((s, k) => (s.tier === 'chibi' ? k : -1)).filter((k) => k >= 0);
    const keyIdx = scenes.map((s, k) => (s.tier === 'key' ? k : -1)).filter((k) => k >= 0);
    const ref = reference
      ? `data:image/jpeg;base64,${(await sharp(reference).rotate().flatten({ background: '#ffffff' }).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()).toString('base64')}`
      : null;

    const chibiJob = async () => {
      if (!chibiIdx.length) return;
      const model = await this.chibi();
      const ids = chibiIdx.map(() => randomUUID());
      const make = (withRef: boolean) => chibiIdx.map((k, j) => ({
        taskType: 'imageInference',
        taskUUID: ids[j],
        model,
        // the hero's main points only (the long list made busy pictures) and what happens in the scene
        positivePrompt: `${CHIBI_LOOK}, ${heroLook.split(',').slice(0, 8).join(',')}, ${scenes[k].tags.replace(heroLook, '').replace(/^solo,\s*/, '').replace(/small figure,?\s*/g, '')}`.slice(0, 2000),
        negativePrompt: CHIBI_NEGATIVE,
        width: side,
        height: side,
        steps: 28,
        CFGScale: 5,
        seed: (seed + k) % 2 ** 31,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        ...(withRef && ref ? { ipAdapters: [{ model: IP_ADAPTER, guideImage: ref, weight: 0.6 }] } : {}),
      }));
      let images: RunwareImage[];
      try {
        images = await this.call(make(true));
      } catch (e) {
        // the adapter refused (model id / parameter): paint from the words alone
        log.warn(`chibi with IP-Adapter failed, without it: ${String(e).slice(0, 200)}`);
        images = await this.call(make(false));
      }
      const got = await this.fetchAll(images, ids);
      chibiIdx.forEach((k, j) => (out[k] = got[j]));
    };

    const keyJob = async () => {
      if (!keyIdx.length) return;
      const ids = keyIdx.map(() => randomUUID());
      const tasks = keyIdx.map((k, j) => ({
        taskType: 'imageInference',
        taskUUID: ids[j],
        model: SEEDREAM,
        positivePrompt: [
          ref ? 'The same character as the reference picture, exactly the same design, colours and proportions' : `The hero: ${heroLook}`,
          `A dramatic key visual from a Japanese TV anime opening, the chorus moment: ${scenes[k].tags}.`,
          'Cinematic composition, dynamic angle, rich lighting, detailed background, high-end anime illustration. Only this one character, no other people. No text, no letters, no watermark.',
        ].join(' ').slice(0, 2000),
        width: 1536,
        height: 1536,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        ...(ref ? { referenceImages: [ref] } : {}),
      }));
      const got = await this.fetchAll(await this.call(tasks, 300_000), ids);
      keyIdx.forEach((k, j) => (out[k] = got[j]));
    };

    const results = await Promise.allSettled([chibiJob(), keyJob()]);
    for (const r of results) if (r.status === 'rejected') log.warn(`styled paint: ${String(r.reason).slice(0, 300)}`);
    return out;
  }
}

/**
 * The storyboard in two looks: everything sung in a chorus becomes one of (at most) `keys` key
 * visuals — neighbouring chorus scenes merge into one long scene that is cut on the bars later —
 * and every other scene is a chibi cut. The hero tags stay on both (the chibi look is added by
 * the painter).
 */
export type TwoLookPlan = Omit<StoryPlan, 'scenes'> & { scenes: (StoryScene & { tier: Tier })[] };

export function twoLooks(p: StoryPlan, lyrics: { t: number; chorus: boolean }[], keys = 2): TwoLookPlan {
  const chorusAt = (t: number) => {
    let c = false;
    for (const l of lyrics) if (l.t <= t + 0.01) c = l.chorus;
    return c;
  };
  const scenes: (StoryScene & { tier: Tier })[] = [];
  let t = 0;
  const chorusScenes = p.scenes.filter((s, k) => chorusAt(p.scenes.slice(0, k).reduce((a, x) => a + x.dur, 0)));
  // the chorus is split into `keys` parts of about the same length
  const chorusLen = chorusScenes.reduce((a, s) => a + s.dur, 0);
  let inChorus = 0;
  for (const s of p.scenes) {
    const c = chorusAt(t);
    t += s.dur;
    if (!c) {
      scenes.push({ ...s, tier: 'chibi' });
      continue;
    }
    const part = Math.min(keys - 1, Math.floor((inChorus / Math.max(chorusLen, 0.01)) * keys));
    inChorus += s.dur;
    const last = scenes[scenes.length - 1];
    const lastPart = (last as { part?: number } | undefined)?.part;
    if (last && last.tier === 'key' && lastPart === part) last.dur += s.dur;
    else scenes.push(Object.assign({ ...s, tier: 'key' as Tier, effect: s.effect === 'GLITCH' ? 'SPEED_LINES' : s.effect }, { part }));
  }
  return { ...p, scenes };
}

/**
 * Photo MV (experiment 2026-10-11): the member's own trip photos redrawn by Seedream 5.0 Pro as
 * high-end anime stills — the same place, food and composition — with the hero (their character)
 * in each picture. One picture per photo, in the photos' order.
 */
export async function photoAnime(
  painter: StyledPainter,
  photos: { photo: Buffer; caption: string }[],
  hero: Buffer | null,
  /** which photos Seedream redraws (~7 yen each); the rest go to Animagine img2img (~0.3 yen). All when omitted. */
  opt: { seedream?: number[]; heroLook?: string; strength?: number; seed?: number; grid?: boolean; model?: Painter } = {},
): Promise<(Buffer | null)[]> {
  painter.lastCostUsd = 0;
  if (opt.grid) return seedreamSheets(painter, photos, hero, opt.model);
  const keyAt = new Set(opt.seedream ?? photos.map((_, k) => k));
  const cheapAt = photos.map((_, k) => k).filter((k) => !keyAt.has(k));
  const [keys, cheap] = await Promise.all([
    seedreamPhotos(painter, photos.filter((_, k) => keyAt.has(k)), hero, opt.model, opt.heroLook),
    cheapAt.length ? animaginePhotos(painter, cheapAt.map((k) => photos[k]), hero, opt) : Promise.resolve([] as (Buffer | null)[]),
  ]);
  let a = 0;
  let b = 0;
  return photos.map((_, k) => (keyAt.has(k) ? keys[a++] : cheap[b++]) ?? null);
}

const MEAL = /soup|stew|chicken|crab|noodle|shrimp|plate|bowl|pot|feast|breakfast|meal|food|rice|stall/i;

/**
 * The cheap photo look (client 2026-10-11: cut the cost): Animagine XL img2img over the photo — the
 * place and food stay where they are, redrawn as anime — with the hero painted in from its tags and
 * its own picture (IP-Adapter). About 0.3 yen a picture against ~7 for Seedream.
 */
async function animaginePhotos(
  painter: StyledPainter,
  photos: { photo: Buffer; caption: string }[],
  hero: Buffer | null,
  opt: { heroLook?: string; strength?: number; seed?: number },
): Promise<(Buffer | null)[]> {
  if (!photos.length) return [];
  const model = await painter.chibi();
  const side = 1024;
  const sq = async (b: Buffer, fit: 'cover' | 'inside') =>
    `data:image/jpeg;base64,${(await sharp(b).rotate().flatten({ background: '#ffffff' }).resize(side, side, { fit }).jpeg({ quality: 90 }).toBuffer()).toString('base64')}`;
  const ref = hero ? await sq(hero, 'inside') : null;
  const look = (opt.heroLook ?? '').split(',').slice(0, 10).join(',');
  const seeds = await Promise.all(photos.map((p) => sq(p.photo, 'cover')));
  const make = (withRef: boolean) =>
    photos.map((p, k) => ({
      taskType: 'imageInference',
      taskUUID: randomUUID(),
      model,
      seedImage: seeds[k],
      strength: opt.strength ?? 0.7,
      positivePrompt: `masterpiece, high score, anime screencap, anime film still, solo, one character, ${look}, ${MEAL.test(p.caption) ? 'sitting at the table eating happily, holding chopsticks' : 'walking and looking around in wonder'}, ${p.caption}, detailed anime background, cinematic lighting, vivid colours, juice or tea only`.slice(0, 2000),
      negativePrompt: `${CHIBI_NEGATIVE}, beer, wine, alcohol, two characters, duplicate`,
      width: side,
      height: side,
      steps: 28,
      CFGScale: 6,
      seed: ((opt.seed ?? 7) + k) % 2 ** 31,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'JPG',
      includeCost: true,
      ...(withRef && ref ? { ipAdapters: [{ model: IP_ADAPTER, guideImage: ref, weight: 0.6 }] } : {}),
    }));
  const withRef = await painter.run(make(true));
  if (withRef.some(Boolean) || !ref) return withRef;
  log.warn('photo img2img with IP-Adapter painted nothing, without it');
  return painter.run(make(false));
}

// a different camera for every picture (m09: thirteen centred eating shots in a row bored the judge)
// m14/m15: an open mouth through a mask while chewing → the food is held up, about to be eaten
const EAT_SHOTS = [
  'Camera: over-the-shoulder from behind the character, the food filling the foreground.',
  'Camera: side profile, the character lifting a bite on chopsticks towards its face, eyes shining.',
  'Camera: top-down view of the whole table, the character leaning in from one edge.',
  'Camera: close-up of the character’s delighted face, the food blurred big in the foreground.',
  'Camera: three-quarter view from a low angle across the table, steam rising between the character and the lens.',
];
// every other meal is not eaten yet: the travel around the food (m13–m15: "too many eating shots in a row")
const ADMIRE_SHOTS = [
  'The character has not started eating: it gazes at the food with sparkling eyes, paws together in delight. Camera: low angle across the table.',
  'The character holds up a small camera to take a picture of the food. Camera: from behind its shoulder.',
  'The character points happily at the dish while the cook serves it. Camera: wide shot of the whole shop.',
  'The character carries the dish to its seat with both paws, careful and proud. Camera: side tracking shot.',
];
const TAKEAWAY_SHOTS = [
  'The character walks out into the street outside with this food in a little takeaway cup or box, looking around happily. Camera: low angle, the street behind.',
  'The character stands at the shop counter on tiptoe, receiving this food from the cook. Camera: wide shot of the shop.',
  'The character runs towards the table carrying this food, tails swinging. Camera: side tracking shot with motion.',
];
const WALK_SHOTS = [
  'Camera: wide establishing shot, the character small in the frame seen from behind, taking in the whole place.',
  'Camera: low angle, the character striding toward the lens with the place towering behind.',
  'Camera: side tracking shot, the character strolling past and looking around in wonder.',
];

async function seedreamPhotos(painter: StyledPainter, photos: { photo: Buffer; caption: string }[], hero: Buffer | null, m: Painter = SEEDREAM_PAINTER, heroLook = ''): Promise<(Buffer | null)[]> {
  return paintScenes(painter, photos, hero, m, heroLook);
}

/** The character's face as drawn (m14: klein opened the mask into a mouth while eating). */
const KEEP_FACE = 'Keep the character’s face exactly as in its reference picture — the same face design, markings and expression shape; never draw an open mouth or teeth that the reference does not have.';

/**
 * One picture per scene with a model that reads reference pictures (PAINTERS). A scene is a photo
 * to redraw (photo MV: reference 1 = the photo, 2 = the hero) or words (story MV: reference 1 = the hero).
 */
export async function paintScenes(
  painter: StyledPainter,
  items: { caption: string; photo?: Buffer }[],
  hero: Buffer | null,
  m: Painter = SEEDREAM_PAINTER,
  /** the hero in words (describeHero's tags): the small models keep the design better told it too (m16: the mask became a child's face) */
  heroLook = '',
): Promise<(Buffer | null)[]> {
  if (!items.length) return [];
  const jpg = async (b: Buffer, side: number) => `data:image/jpeg;base64,${(await sharp(b).rotate().flatten({ background: '#ffffff' }).resize(side, side, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer()).toString('base64')}`;
  const heroRef = hero ? await jpg(hero, 1024) : null;
  // a close-up of the hero's face as one more reference (m16–m18: the small model kept turning the
  // face — a mask here — into a new face): the top of the picture, where a character's face is
  const faceRef = hero ? await faceCrop(hero).catch(() => null) : null;
  let e = 0;
  let a = 0;
  let w = 0;
  let meals = 0;
  const tasks = await Promise.all(
    items.map(async (p) => {
      const refs = [...(p.photo ? [await jpg(p.photo, 1280)] : []), ...(heroRef ? [heroRef] : []), ...(faceRef ? [faceRef] : [])].slice(0, m.maxRefs);
      const meal = MEAL.test(p.caption);
      // meals in thirds: eating, not eaten yet, and on the move with it (m16: "static seated tables")
      const turn = meal ? meals++ % 3 : -1;
      const shot = turn === 0 ? EAT_SHOTS[e++ % EAT_SHOTS.length] : turn === 1 ? ADMIRE_SHOTS[a++ % ADMIRE_SHOTS.length] : turn === 2 ? TAKEAWAY_SHOTS[w % TAKEAWAY_SHOTS.length] : WALK_SHOTS[w++ % WALK_SHOTS.length];
      // the hero is the traveller (client 2026-10-11: KIMORIN travels Busan, eats the food in the
      // photos, wanders the streets) — exactly one of them in every picture, never two
      const lines = p.photo
        ? [
            `A breathtaking still from a high-end Japanese anime film. The place, the food and the composition come from the first reference photo (${p.caption}) — keep them the same.`,
            heroRef
              ? 'The traveller in this film is the character from the second reference picture (exactly the same design, colours and proportions): show that character exactly once in the scene, actually being in this place — at this table, in these streets, at this view — as the camera note says. Exactly one of this character; never two copies.'
              : '',
            shot,
          ]
        : [
            `A breathtaking still from a high-end Japanese anime film: ${p.caption}.`,
            heroRef ? 'The main character is the one in the reference picture (exactly the same design, colours and proportions), shown exactly once, really doing what the scene describes.' : '',
            p.caption.includes('wide shot') ? '' : shot,
          ];
      return {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: m.model,
        positivePrompt: [
          ...lines,
          heroRef ? KEEP_FACE : '',
          faceRef && refs.includes(faceRef) ? 'The last reference picture is a close-up of the same character’s face: copy that face exactly.' : '',
          heroRef && heroLook ? `The character, in words: ${heroLook.split(',').slice(0, 12).join(',')}.` : '',
          // m17: "never beer" drew beer (a small model reads the word, not the never) → name only the drinks we want
          'Any glass on the table holds orange juice, green tea or milk.',
          'Cinematic anime lighting, glowing colours, rich detailed hand-painted background, appetising food, crisp line art, fully drawn in 2D anime style. No text, no letters, no logos, no watermark. Other people only as small simple passers-by in the background.',
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 3000),
        width: m.single,
        height: m.single,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        ...(refs.length ? { referenceImages: refs } : {}),
      };
    }),
  );
  return painter.run(tasks);
}

/** The hero's face: the picture trimmed to the character, its top 45%, the middle 70% across. */
async function faceCrop(hero: Buffer): Promise<string> {
  const trimmed = await sharp(hero).rotate().flatten({ background: '#ffffff' }).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = trimmed.info;
  const w = Math.round(W * 0.7);
  const h = Math.min(H, Math.round(Math.max(H * 0.45, w)));
  const face = await sharp(trimmed.data).extract({ left: Math.round((W - w) / 2), top: 0, width: w, height: h }).resize(768, 768, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${face.toString('base64')}`;
}

/**
 * Four scenes in one Seedream picture (MV lab m12: 6.2 at ~27 yen against 6.0 at ~100 for one
 * picture each): a 2x2 sheet of four anime stills cut apart afterwards — 1536px makes 768px panels,
 * just above the MV's 720 (nothing is made above 720p, docs/media.md) — so ~7 yen buys four scenes.
 * A scene is a photo to redraw (photo MV) or words (story MV). A short last sheet repeats earlier
 * scenes in its empty panels (the same price either way) and drops them.
 */
export async function seedreamSheets(painter: StyledPainter, items: { caption: string; photo?: Buffer }[], hero: Buffer | null, m: Painter = SEEDREAM_PAINTER): Promise<(Buffer | null)[]> {
  if (!items.length) return [];
  const jpg = async (b: Buffer, side: number) => `data:image/jpeg;base64,${(await sharp(b).rotate().flatten({ background: '#ffffff' }).resize(side, side, { fit: 'inside' }).jpeg({ quality: 86 }).toBuffer()).toString('base64')}`;
  const heroRef = hero ? await jpg(hero, 1024) : null;
  const groups: number[][] = [];
  for (let i = 0; i < items.length; i += 4) groups.push([0, 1, 2, 3].map((j) => (i + j < items.length ? i + j : (i + j) % items.length)));
  const where = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  let e = 0;
  let w = 0;
  const tasks = await Promise.all(
    groups.map(async (g) => {
      const refs: string[] = heroRef ? [heroRef] : [];
      const panels: string[] = [];
      for (const [j, k] of g.entries()) {
        const it = items[k];
        const shot = MEAL.test(it.caption) ? EAT_SHOTS[e++ % EAT_SHOTS.length] : WALK_SHOTS[w++ % WALK_SHOTS.length];
        if (it.photo) {
          refs.push(await jpg(it.photo, 1024));
          panels.push(`Panel ${j + 1} (${where[j]}): redraw reference picture ${refs.length} (${it.caption}) — the same place and food. ${shot}`);
        } else panels.push(`Panel ${j + 1} (${where[j]}): ${it.caption}. ${it.caption.includes('wide shot') ? '' : shot}`);
      }
      return {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        model: m.model,
        positivePrompt: [
          'A 2x2 sheet of four separate square stills from the same high-end Japanese anime film, four equal panels split by thin straight white gutters, each panel a complete picture on its own, all in the same 2D anime style (no photographic parts).',
          ...panels,
          heroRef
            ? `In every panel the main character is the one from reference picture 1 (exactly the same design, colours and proportions), shown exactly once per panel, really doing what the panel describes. ${KEEP_FACE}`
            : '',
          'Any glass holds orange juice, green tea or milk. Cinematic anime lighting, glowing colours, rich hand-painted backgrounds, crisp line art. No text, no letters, no logos, no watermark. Other people only as small passers-by.',
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 3000),
        width: m.sheet,
        height: m.sheet,
        numberResults: 1,
        outputType: 'URL',
        outputFormat: 'JPG',
        includeCost: true,
        ...(refs.length ? { referenceImages: refs.slice(0, m.maxRefs) } : {}),
      };
    }),
  );
  const sheets = await painter.run(tasks);
  const out: (Buffer | null)[] = items.map(() => null);
  await Promise.all(
    groups.map(async (g, gi) => {
      const img = sheets[gi];
      if (!img) return;
      const meta = await sharp(img).metadata();
      const W = meta.width ?? 1536;
      const H = meta.height ?? 1536;
      // each quarter, a little inside so the gutters fall away
      const trim = Math.round(W * 0.012);
      await Promise.all(
        g.map(async (k, j) => {
          if (gi * 4 + j >= items.length) return; // a repeat filling an empty panel
          const left = (j % 2) * Math.floor(W / 2) + trim;
          const top = Math.floor(j / 2) * Math.floor(H / 2) + trim;
          out[k] = await sharp(img)
            .extract({ left, top, width: Math.floor(W / 2) - trim * 2, height: Math.floor(H / 2) - trim * 2 })
            .resize(768, 768)
            .jpeg({ quality: 92 })
            .toBuffer();
        }),
      );
    }),
  );
  return out;
}
