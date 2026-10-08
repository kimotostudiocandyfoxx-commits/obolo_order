import { Logger } from '@nestjs/common';
import type { MvEffect, MvMotion, MvPlan, MvSegment, MvTextEffect } from './plan';

/**
 * Story MV (client decision 2026-10-08): no materials from the user — Bati reads the song (lyrics with
 * their times and sections, tempo, length, the instrumental's mood) and the user's profile picture
 * (the hero), writes a storyboard of up to MV_SCENES scenes, and every scene is painted as an anime
 * picture (Novita, Animagine XL). The pictures are then edited like photos (motion, effects, cuts on
 * the beat) by render.ts.
 *  - describeHero: the profile picture → Danbooru-style tags, so the hero looks the same in every scene.
 *  - planStory: Gemini Flash-Lite with a fixed JSON schema; without a key (or if the answer is
 *    unusable) a storyboard is made by rule from a set of anime scenes.
 */
export type StoryScene = { dur: number; tags: string; hero: boolean; motion: MvMotion; effect: MvEffect };
export type StoryPlan = { note: string; style: string; scenes: StoryScene[]; lyrics: MvTextEffect[] };
export type StoryLyric = { t: number; text: string; chorus: boolean };
export type StoryInput = { title: string; seconds: number; bpm: number; mood: string; music: string; lyrics: StoryLyric[]; hero: string; maxScenes: number };

const MOTIONS: MvMotion[] = ['zoom-in', 'pan-left', 'zoom-out', 'pan-right'];
const EFFECTS: MvEffect[] = ['POSTERIZE', 'GLITCH', 'SPEED_LINES', 'NONE'];
const TEXT_EFFECTS: MvTextEffect[] = ['SHAKE_HARD', 'STROBO_FLASH', 'ZOOM_BURST', 'MINIMAL_CHILL'];
const log = new Logger('MvStory');
const gemini = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** A plain hero when there is no picture (or it cannot be read). */
export const DEFAULT_HERO = '1girl, solo, short hair, bright eyes, hoodie, cheerful';

/** The profile picture → tags for the hero (Gemini Flash-Lite, vision). */
export async function describeHero(picture: Buffer | null, apiKey: string | undefined, model: string): Promise<string> {
  if (!picture || !apiKey) return DEFAULT_HERO;
  try {
    const res = await fetch(gemini(model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/png', data: picture.toString('base64') } },
              {
                text: 'This is the hero of an anime music video. Describe how they look as Danbooru-style tags for an anime image model, so the same character can be drawn in many scenes: subject (1girl / 1boy / creature…), hair, eyes, skin, outfit, colours, accessories, body shape. 10–20 tags, comma-separated, English, nothing about the background or pose. Kids-friendly.',
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { tags: { type: 'STRING' } }, required: ['tags'] }, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const tags = (JSON.parse(json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '{}') as { tags?: string }).tags ?? '';
    return clean(tags) || DEFAULT_HERO;
  } catch (e) {
    log.warn(`hero by default (${String(e).slice(0, 120)})`);
    return DEFAULT_HERO;
  }
}

/** Only plain tags (no weights, no line breaks, no NSFW words), not too long. */
function clean(tags: string) {
  return tags
    .replace(/[\n\r()[\]{}<>:]/g, ' ')
    .replace(/\b(nsfw|nude|naked|sexy|lingerie|underwear|gore|blood)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .slice(0, 400);
}

/** How many scenes: one per ~2 bars, between 8 and maxScenes. */
export function sceneCount(i: Pick<StoryInput, 'seconds' | 'bpm' | 'maxScenes'>) {
  const bar = (60 / (i.bpm || 100)) * 4;
  return Math.max(8, Math.min(i.maxScenes, Math.round(i.seconds / Math.max(2.4, bar * 2))));
}

function chorusAt(i: StoryInput, t: number) {
  let chorus = false;
  for (const l of i.lyrics) if (l.t <= t + 0.01) chorus = l.chorus;
  return chorus;
}

const SETTINGS = [
  'city street at night, neon lights, rain reflections',
  'rooftop at sunset, wind, city skyline',
  'school classroom, warm afternoon light',
  'summer beach, blue sky, waves, sparkles',
  'starry sky, shooting stars, hill, grass',
  'train window, passing scenery, golden hour',
  'flower field, petals in the wind',
  'bedroom, headphones, fairy lights, cozy',
  'festival, lanterns, fireworks in the sky',
  'galaxy, planets, floating in space, glowing',
];

/** Storyboard by rule: settings in turn, the hero in most scenes, close-ups and loud effects on the chorus. */
export function ruleStory(i: StoryInput): StoryPlan {
  const n = sceneCount(i);
  const beat = 60 / (i.bpm || 100);
  // durations on whole beats, the last one takes the rest
  const per = Math.max(beat, Math.round(i.seconds / n / beat) * beat);
  const scenes: StoryScene[] = [];
  let t = 0;
  for (let k = 0; k < n && t < i.seconds - 0.05; k++) {
    const dur = k === n - 1 ? i.seconds - t : Math.min(per, i.seconds - t);
    const loud = chorusAt(i, t);
    const hero = k % 3 !== 2;
    const shot = loud ? (k % 2 ? 'close-up, dynamic angle, singing' : 'upper body, dynamic pose, wind') : hero ? 'cowboy shot, looking at viewer' : 'scenery, no humans, wide shot';
    scenes.push({
      dur,
      tags: `${hero ? `${i.hero}, ` : ''}${shot}, ${SETTINGS[Math.floor(k / 2) % SETTINGS.length]}`,
      hero,
      motion: MOTIONS[k % MOTIONS.length],
      effect: loud ? (k % 2 ? 'GLITCH' : 'SPEED_LINES') : 'NONE',
    });
    t += dur;
  }
  let first = true;
  const lyrics = i.lyrics.map((l): MvTextEffect => {
    if (!l.chorus) return 'MINIMAL_CHILL';
    const e = first ? 'ZOOM_BURST' : 'STROBO_FLASH';
    first = false;
    return e;
  });
  return { note: '歌詞の流れにあわせて、きみが主人公のアニメにしたよ。', style: 'anime', scenes, lyrics };
}

/** Make any storyboard safe: sane lengths, exactly the song's length, at most maxScenes, the hero's tags on hero scenes. */
export function normalizeStory(p: Partial<StoryPlan>, i: StoryInput): StoryPlan {
  const rule = ruleStory(i);
  const style = clean(p.style ?? '');
  const scenes: StoryScene[] = [];
  let t = 0;
  for (const s of (p.scenes ?? []).slice(0, i.maxScenes)) {
    if (t >= i.seconds - 0.05) break;
    const dur = Math.min(Math.max(Number(s.dur) || 3, 1.2), 12, i.seconds - t);
    const hero = s.hero !== false;
    const own = clean(s.tags ?? '');
    if (!own) continue;
    scenes.push({
      dur,
      hero,
      tags: [hero ? i.hero : '', own, style].filter(Boolean).join(', '),
      motion: MOTIONS.includes(s.motion) || s.motion === 'still' ? s.motion : 'zoom-in',
      effect: EFFECTS.includes(s.effect) ? s.effect : 'NONE',
    });
    t += dur;
  }
  if (scenes.length < 3) return rule;
  // stretch the last scene to the end (or add one more from the rule storyboard)
  if (t < i.seconds - 0.05) {
    const rest = i.seconds - t;
    if (rest <= 4 || scenes.length >= i.maxScenes) scenes[scenes.length - 1].dur += rest;
    else scenes.push({ ...rule.scenes[rule.scenes.length - 1], dur: rest });
  }
  const lyrics = i.lyrics.map((_, k) => (TEXT_EFFECTS.includes(p.lyrics?.[k] as MvTextEffect) ? (p.lyrics![k] as MvTextEffect) : rule.lyrics[k]));
  return { note: (p.note || '').slice(0, 160) || rule.note, style, scenes, lyrics };
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    note: { type: 'STRING', description: 'one friendly sentence in casual Japanese, like a buddy, about the story of the MV' },
    style: { type: 'STRING', description: 'tags shared by every scene: colour palette, lighting, art direction (English, comma-separated)' },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dur: { type: 'NUMBER', description: 'seconds, whole beats' },
          hero: { type: 'BOOLEAN', description: 'true = the hero is in this scene' },
          tags: {
            type: 'STRING',
            description:
              'Danbooru-style tags for this picture only: shot (close-up / upper body / full body / wide shot / scenery, no humans), action, expression, place, time, weather, light. English, comma-separated. Do not describe the hero’s looks.',
          },
          motion: { type: 'STRING', enum: ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'still'] },
          effect: { type: 'STRING', enum: EFFECTS, description: 'POSTERIZE = cel colours, GLITCH = colour split shake, SPEED_LINES = manga speed lines, NONE' },
        },
        required: ['dur', 'hero', 'tags', 'motion', 'effect'],
      },
    },
    lyrics: { type: 'ARRAY', description: 'one text effect per lyric line, in order', items: { type: 'STRING', enum: TEXT_EFFECTS } },
  },
  required: ['note', 'style', 'scenes', 'lyrics'],
};

/** Ask Gemini (Flash-Lite) for the storyboard; falls back to the rule storyboard. */
export async function planStory(i: StoryInput, apiKey: string | undefined, model: string): Promise<StoryPlan> {
  if (!apiKey) return ruleStory(i);
  const n = sceneCount(i);
  const beat = 60 / (i.bpm || 100);
  const prompt = [
    'You are a brilliant anime music video director (kids-friendly app). Write the storyboard of a square anime MV; every scene becomes one anime picture.',
    `Song: "${i.title}", ${i.seconds.toFixed(1)} seconds, ${Math.round(i.bpm)} BPM (one beat = ${beat.toFixed(3)} s). Music: ${i.music || 'pop'}.`,
    i.lyrics.length ? `Lyric lines (start second [section]: text):\n${i.lyrics.map((l) => `${l.t.toFixed(1)} [${l.chorus ? 'chorus' : 'verse'}]: ${l.text}`).join('\n')}` : 'Instrumental, no lyrics.',
    i.mood ? `What the creator wants: ${i.mood}` : 'The creator left the mood to you: read it from the lyrics and the music.',
    `The hero is the creator's own character (${i.hero}).`,
    `Write about ${n} scenes (at most ${i.maxScenes}) that tell one story following the lyrics: each scene shows what the lyric line playing under it is about. Keep places consistent within a section, change them between sections. The hero appears in most scenes; use a few hero-less scenery shots for breathing room.`,
    'Verses calm (NONE or POSTERIZE, MINIMAL_CHILL lyrics); chorus big (close-ups, dynamic angles, GLITCH / SPEED_LINES, ZOOM_BURST / STROBO_FLASH / SHAKE_HARD lyrics). Vary the motion.',
    `Scene durations are whole beats and add up to ${i.seconds.toFixed(1)} seconds. Give exactly ${i.lyrics.length} lyric effects.`,
  ].join('\n');
  try {
    const res = await fetch(gemini(model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.7, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return normalizeStory(JSON.parse(text) as StoryPlan, i);
  } catch (e) {
    log.warn(`storyboard by rule (${String(e).slice(0, 160)})`);
    return ruleStory(i);
  }
}

/** The storyboard as an edit plan for render.ts: scene k = picture k (already anime: no extra look). */
export function storyToPlan(p: StoryPlan): MvPlan {
  const segments: MvSegment[] = p.scenes.map((s, k) => ({ m: k, dur: s.dur, from: 0, motion: s.motion === 'still' ? 'zoom-in' : s.motion, effect: s.effect, key: false }));
  return { note: p.note, segments, lyrics: p.lyrics };
}
