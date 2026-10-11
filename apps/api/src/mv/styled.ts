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
  async run(tasks: Record<string, unknown>[]): Promise<(Buffer | null)[]> {
    this.lastCostUsd = 0;
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
export async function photoAnime(painter: StyledPainter, photos: { photo: Buffer; caption: string }[], hero: Buffer | null): Promise<(Buffer | null)[]> {
  const jpg = async (b: Buffer, side: number) => `data:image/jpeg;base64,${(await sharp(b).rotate().flatten({ background: '#ffffff' }).resize(side, side, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer()).toString('base64')}`;
  const heroRef = hero ? await jpg(hero, 1024) : null;
  // a different camera for every picture (m09: thirteen centred eating shots in a row bored the judge)
  const meal = /soup|stew|chicken|crab|noodle|shrimp|plate|bowl|pot|feast|breakfast|meal|food|rice|stall/i;
  const eatShots = [
    'Camera: over-the-shoulder from behind the character, the food filling the foreground.',
    'Camera: side profile, the character mid-bite with chopsticks, cheeks full and happy.',
    'Camera: top-down view of the whole table, the character leaning in from one edge.',
    'Camera: close-up of the character’s delighted face, the food blurred big in the foreground.',
    'Camera: three-quarter view from a low angle across the table, steam rising between the character and the lens.',
  ];
  const walkShots = [
    'Camera: wide establishing shot, the character small in the frame seen from behind, taking in the whole place.',
    'Camera: low angle, the character striding toward the lens with the place towering behind.',
    'Camera: side tracking shot, the character strolling past and looking around in wonder.',
  ];
  let e = 0;
  let w = 0;
  const tasks = await Promise.all(
    photos.map(async (p) => ({
      taskType: 'imageInference',
      taskUUID: randomUUID(),
      model: SEEDREAM,
      // the hero is the traveller (client 2026-10-11: KIMORIN travels Busan, eats the food in the
      // photos, wanders the streets) — exactly one of them in every picture, never two
      positivePrompt: [
        `A breathtaking still from a high-end Japanese anime film. The place, the food and the composition come from the first reference photo (${p.caption}) — keep them the same.`,
        heroRef
          ? 'The traveller in this film is the character from the second reference picture (exactly the same design, colours and proportions): show that character exactly once in the scene, actually doing what the photo shows — eating this food with relish, sitting at this table, walking these streets, gazing at this view. Exactly one of this character; never two copies.'
          : '',
        meal.test(p.caption) ? eatShots[e++ % eatShots.length] : walkShots[w++ % walkShots.length],
        'A picture for children: any drink on the table is juice, tea or water — never beer, wine or other alcohol.',
        'Cinematic anime lighting, glowing colours, rich detailed hand-painted background, appetising food, crisp line art. No text, no letters, no logos, no watermark. Other people only as small simple passers-by in the background.',
      ]
        .filter(Boolean)
        .join(' '),
      width: 1536,
      height: 1536,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'JPG',
      includeCost: true,
      referenceImages: [await jpg(p.photo, 1280), ...(heroRef ? [heroRef] : [])],
    })),
  );
  return painter.run(tasks);
}
