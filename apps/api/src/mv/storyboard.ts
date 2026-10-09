import { Logger } from '@nestjs/common';
import sharp from 'sharp';
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

/** The hero is a person (not a creature / mascot / animal), from its tags. */
export function isHuman(heroTags: string) {
  return /\b\d?(girl|boy|woman|man)s?\b/i.test(heroTags) && !/\b(creature|mascot|animal|robot)\b/i.test(heroTags);
}

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
              { inlineData: { mimeType: 'image/jpeg', data: (await sharp(picture).rotate().flatten({ background: '#ffffff' }).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()).toString('base64') } },
              {
                // MV lab m02: a loose description lost "chibi" and the white mask → a tall fox-man in a black visor
                text: 'This is the hero of an anime music video. Describe how they look as Danbooru-style tags for an anime image model, so exactly the same character can be drawn in many scenes. In this order: 1) subject (1girl / 1boy / creature / mascot…), 2) body proportions (chibi / small / tall / round…), 3) face exactly (if the face is a mask: its colour, shape and markings; otherwise hair and eyes), 4) ears, tail(s), 5) outfit with colours, 6) accessories, 7) the 2–3 main colours. 12–22 tags, comma-separated, English, nothing about the background, pose or expression. Kids-friendly.',
              },
            ],
          },
        ],
        // the same picture always gives the same tags
        generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { tags: { type: 'STRING' } }, required: ['tags'] }, temperature: 0, seed: 7 },
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

/** How many scenes: one per ~1.5 bars (MV lab m03: 6-second scenes dragged), between 8 and maxScenes. */
export function sceneCount(i: Pick<StoryInput, 'seconds' | 'bpm' | 'maxScenes'>) {
  const bar = (60 / (i.bpm || 100)) * 4;
  return Math.max(8, Math.min(i.maxScenes, Math.round(i.seconds / Math.max(2.4, bar * 1.5))));
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

/** GLITCH only suits loud electronic / rock songs (MV lab m01: it clashed with soft songs) → speed lines. */
function calmEffect(e: MvEffect, music: string): MvEffect {
  // POSTERIZE banded the painted shading (MV lab m03) → none on painted scenes
  if (e === 'POSTERIZE') return 'NONE';
  return e === 'GLITCH' && !/rock|edm|electro|metal|dubstep|techno|trap|punk/i.test(music) ? 'SPEED_LINES' : e;
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
    // MV lab m04: the hero-less scenery shots (club, stage, rooftop) kept painting stray people even
    // with "no humans" → the hero is in every picture; a "scenery" shot shows them small in a wide view
    const own = clean(s.tags ?? '').replace(/\b(1girl|1boy|2girls|2boys|girl|boy|person|people|crowd|human|no humans)s?\b,?/gi, '');
    if (!own.trim()) continue;
    const wide = s.hero === false ? 'wide shot, scenery, small figure, ' : '';
    scenes.push({
      dur,
      hero: true,
      tags: [`solo, ${i.hero}`, `${wide}${own}`, style].filter(Boolean).join(', '),
      motion: MOTIONS.includes(s.motion) || s.motion === 'still' ? s.motion : 'zoom-in',
      effect: calmEffect(EFFECTS.includes(s.effect) ? s.effect : 'NONE', i.music),
    });
    t += dur;
  }
  if (scenes.length < 3) return rule;
  // stretch the last scene to the end (its shots are cut on the bars) — a rule scene added here had
  // other tags and changed the hero's outfit at the very end (MV lab m04)
  if (t < i.seconds - 0.05) scenes[scenes.length - 1].dur += i.seconds - t;
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
    `Write ${n} scenes (at most ${i.maxScenes}) that tell one story following the lyrics: each scene shows what the lyric line playing under it is about. Keep places consistent within a section, change them between sections. Use a few wide views for breathing room.`,
    'Start a new scene where a new lyric line starts, so the picture always shows the line being sung. The hero is in every picture and is the only character: never other people or creatures (hero = false only for a wide view where the hero is small in the landscape). Keep one world for the whole MV (no modern gadgets or a different era unless the lyrics are about them).',
    'Verses calm (NONE, MINIMAL_CHILL lyrics); chorus big (close-ups, dynamic angles, low angle, SPEED_LINES, ZOOM_BURST / STROBO_FLASH lyrics; GLITCH / SHAKE_HARD only for loud rock or electronic songs). Vary shot sizes (wide, full body, upper body, close-up) and angles (from the side, from behind, from above, low angle, looking back) — never two front-facing shots in a row; vary places and light. End with a memorable closing image.',
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

/**
 * The storyboard as an edit plan for render.ts: scene k = picture k (already anime: no extra look).
 * With the tempo, a long scene is cut on the bars into several shots of the same picture with
 * different camera moves — every 2 bars in a verse, every bar in a chorus (MV lab m01: 4-second
 * shots felt like a slideshow and missed the beat). More cuts, no more pictures to paint.
 */
export function storyToPlan(p: StoryPlan, bpm?: number, lyrics: StoryLyric[] = []): MvPlan {
  const segments: MvSegment[] = [];
  const bar = bpm ? (60 / bpm) * 4 : 0;
  let t = 0;
  p.scenes.forEach((s, k) => {
    const first: MvSegment['motion'] = s.motion === 'still' ? 'zoom-in' : s.motion;
    let chorus = false;
    for (const l of lyrics) if (l.t <= t + 0.01) chorus = l.chorus;
    const each = bar ? bar * (chorus ? 1 : 2) : s.dur;
    const n = bar && s.dur >= each * 1.5 ? Math.min(8, Math.floor(s.dur / each + 0.25)) : 1;
    const last = k === p.scenes.length - 1;
    for (let j = 0; j < n; j++) {
      const dur = j === n - 1 ? s.dur - each * (n - 1) : each;
      const move = MOTIONS[(Math.max(0, MOTIONS.indexOf(first)) + j * 2 + (j >> 1)) % MOTIONS.length];
      // the long last scene (the outro) ends as a highlight reel: after two shots of it, the earlier
      // pictures come back one per cut, and the closing picture returns for the very last shot
      // (MV lab m05: "the final shot holds static for over ten seconds")
      const back = last && j >= 2 && j < n - 1 && k > 0 ? Math.max(0, k - 1 - ((j - 2) * 2) % k) : k;
      // in a chorus every other shot beats with the song
      segments.push({ m: back, dur, from: 0, motion: (chorus || back !== k) && j % 2 === 1 ? 'pulse' : move, effect: j === 0 ? s.effect : 'NONE', key: false });
    }
    t += s.dur;
  });
  return { note: p.note, segments, lyrics: p.lyrics };
}
