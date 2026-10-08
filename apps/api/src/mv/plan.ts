import { Logger } from '@nestjs/common';

/**
 * Bati's MV direction sheet (client decisions 2026-10-08: Gemini Flash-Lite with a fixed JSON
 * schema). It looks at the materials (a picture of each) and the song (length, tempo, lyric lines
 * with their times and sections) and decides:
 *  - the cuts: which material, how long, the camera motion, the picture effect
 *    (POSTERIZE = cel colours, GLITCH = colour split, SPEED_LINES = manga lines, NONE),
 *    and the キメ絵 (key = this picture is redrawn as an anime illustration — only a few per MV);
 *  - how each lyric line appears (SHAKE_HARD, STROBO_FLASH, ZOOM_BURST, MINIMAL_CHILL).
 * Without a Gemini key (or if the answer is unusable) the sheet is made by rule: cuts on the beat,
 * the loud effects on the chorus.
 */
export type MvMotion = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'still';
export type MvEffect = 'POSTERIZE' | 'GLITCH' | 'SPEED_LINES' | 'NONE';
export type MvTextEffect = 'SHAKE_HARD' | 'STROBO_FLASH' | 'ZOOM_BURST' | 'MINIMAL_CHILL';
export type MvSegment = { m: number; dur: number; from: number; motion: MvMotion; effect: MvEffect; key: boolean };
export type MvPlan = { note: string; segments: MvSegment[]; lyrics: MvTextEffect[] };

export type PlanMaterial = { kind: 'photo' | 'video'; seconds: number | null; preview: Buffer | null };
export type PlanLyric = { t: number; text: string; chorus: boolean };
export type PlanInput = { title: string; seconds: number; bpm: number; lyrics: PlanLyric[]; materials: PlanMaterial[]; keyCuts: number };

const MOTIONS: MvMotion[] = ['zoom-in', 'pan-left', 'zoom-out', 'pan-right'];
const EFFECTS: MvEffect[] = ['POSTERIZE', 'GLITCH', 'SPEED_LINES', 'NONE'];
const TEXT_EFFECTS: MvTextEffect[] = ['SHAKE_HARD', 'STROBO_FLASH', 'ZOOM_BURST', 'MINIMAL_CHILL'];
const log = new Logger('MvPlan');

/** Is second t inside a chorus line? */
function inChorus(i: PlanInput, t: number) {
  let chorus = false;
  for (const l of i.lyrics) if (l.t <= t + 0.01) chorus = l.chorus;
  return chorus;
}

/** One cut every 4 beats (≈ 2 s), the materials in turn; the chorus gets the loud effects and the キメ絵. */
export function rulePlan(i: PlanInput): MvPlan {
  const beat = 60 / (i.bpm || 100);
  const cut = Math.min(4, Math.max(1.6, beat * 4));
  const segments: MvSegment[] = [];
  let t = 0;
  let k = 0;
  const keyed = new Set<number>();
  while (t < i.seconds - 0.05) {
    const m = k % i.materials.length;
    const mat = i.materials[m];
    const dur = Math.min(cut, i.seconds - t);
    const from = mat.kind === 'video' && mat.seconds ? (k * 1.7) % Math.max(0.01, mat.seconds - dur) || 0 : 0;
    const loud = inChorus(i, t);
    const key = loud && keyed.size < i.keyCuts && !keyed.has(m);
    if (key) keyed.add(m);
    const effect: MvEffect = key ? 'NONE' : loud ? (k % 2 ? 'GLITCH' : 'SPEED_LINES') : 'POSTERIZE';
    segments.push({ m, dur, from, motion: mat.kind === 'video' && !key ? 'still' : MOTIONS[k % MOTIONS.length], effect, key });
    t += dur;
    k++;
  }
  let firstChorus = true;
  const lyrics = i.lyrics.map((l): MvTextEffect => {
    if (!l.chorus) return 'MINIMAL_CHILL';
    const e = firstChorus ? 'ZOOM_BURST' : 'STROBO_FLASH';
    firstChorus = false;
    return e;
  });
  return { note: '曲のリズムに合わせて素材を切りかえて、サビはハデにしたよ。', segments, lyrics };
}

/** Make any sheet safe to render: known materials, sane lengths, exactly the song's length, few キメ絵. */
export function normalizePlan(p: Partial<MvPlan>, i: PlanInput): MvPlan {
  const segs: MvSegment[] = [];
  let t = 0;
  const keyed = new Set<number>();
  for (const s of p.segments ?? []) {
    if (t >= i.seconds - 0.05) break;
    const m = Number.isInteger(s.m) && s.m >= 0 && s.m < i.materials.length ? s.m : segs.length % i.materials.length;
    const mat = i.materials[m];
    const dur = Math.min(Math.max(Number(s.dur) || 2, 1.2), 8, i.seconds - t);
    const maxFrom = mat.kind === 'video' && mat.seconds ? Math.max(0, mat.seconds - dur) : 0;
    const from = Math.min(Math.max(Number(s.from) || 0, 0), maxFrom);
    const motion = (MOTIONS as string[]).includes(s.motion) || s.motion === 'still' ? s.motion : 'zoom-in';
    const effect = EFFECTS.includes(s.effect) ? s.effect : 'NONE';
    // the キメ絵 budget counts materials (one redraw each, reused)
    const key = s.key === true && (keyed.has(m) || keyed.size < i.keyCuts);
    if (key) keyed.add(m);
    segs.push({ m, dur, from, motion, effect, key });
    t += dur;
  }
  // too short: keep going with the rule sheet's rhythm
  if (t < i.seconds - 0.05) {
    const rest = rulePlan({ ...i, seconds: i.seconds - t, lyrics: [], keyCuts: 0 }).segments.map((s, k) => ({ ...s, m: (segs.length + k) % i.materials.length }));
    segs.push(...rest);
  }
  const rule = rulePlan(i);
  const lyrics = i.lyrics.map((_, k) => (TEXT_EFFECTS.includes(p.lyrics?.[k] as MvTextEffect) ? (p.lyrics![k] as MvTextEffect) : rule.lyrics[k]));
  return { note: (p.note || '').slice(0, 160) || rule.note, segments: segs, lyrics };
}

/** The fixed answer shape (Gemini structured output: nothing but this JSON comes back). */
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    note: { type: 'STRING', description: 'one friendly sentence in casual Japanese, like a buddy, about how you directed it' },
    segments: {
      type: 'ARRAY',
      description: 'the cuts in order; durations add up to the song length',
      items: {
        type: 'OBJECT',
        properties: {
          m: { type: 'INTEGER', description: 'material index' },
          dur: { type: 'NUMBER', description: 'seconds, a multiple of one beat' },
          from: { type: 'NUMBER', description: 'start second inside a video (0 for photos)' },
          motion: { type: 'STRING', enum: ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'still'] },
          effect: { type: 'STRING', enum: EFFECTS, description: 'POSTERIZE = cel-animation colours, GLITCH = colour split shake, SPEED_LINES = manga speed lines, NONE' },
          key: { type: 'BOOLEAN', description: 'true = this cut is a キメ絵: the picture is redrawn as an anime illustration (chorus / punchlines only)' },
        },
        required: ['m', 'dur', 'from', 'motion', 'effect', 'key'],
      },
    },
    lyrics: {
      type: 'ARRAY',
      description: 'one text effect per lyric line, in order',
      items: { type: 'STRING', enum: TEXT_EFFECTS },
    },
  },
  required: ['note', 'segments', 'lyrics'],
};

/** Ask Gemini (Flash-Lite) for the direction sheet; falls back to the rule sheet. */
export async function planMv(i: PlanInput, apiKey: string | undefined, model: string): Promise<MvPlan> {
  if (!apiKey) return rulePlan(i);
  const parts: Record<string, unknown>[] = [
    {
      text: [
        'You are a brilliant music video director for a kids-friendly music app. Direct a square MV made from the materials below.',
        `Song: "${i.title}", ${i.seconds.toFixed(1)} seconds, ${Math.round(i.bpm)} BPM (one beat = ${(60 / (i.bpm || 100)).toFixed(3)} s).`,
        i.lyrics.length ? `Lyric lines (start second [section]: text):\n${i.lyrics.map((l) => `${l.t.toFixed(1)} [${l.chorus ? 'chorus' : 'verse'}]: ${l.text}`).join('\n')}` : 'No lyrics.',
        `Materials (index: kind, length): ${i.materials.map((m, k) => `${k}: ${m.kind}${m.seconds ? ` ${m.seconds.toFixed(1)}s` : ''}`).join(', ')}. A picture of each follows in order.`,
        'Cut on the beat, match each material to the mood of the lyric line it plays under, use every material at least once, vary the motion (videos usually "still").',
        'Keep the verses calm (POSTERIZE or NONE, MINIMAL_CHILL lyrics); go wild on the chorus and the punchlines (GLITCH, SPEED_LINES, SHAKE_HARD, STROBO_FLASH, ZOOM_BURST).',
        `Mark at most ${i.keyCuts} different materials as key (キメ絵) — put the strongest pictures on the chorus.`,
        `The durations must add up to ${i.seconds.toFixed(1)} seconds. Give exactly ${i.lyrics.length} lyric effects.`,
      ].join('\n'),
    },
  ];
  for (const m of i.materials) if (m.preview) parts.push({ inlineData: { mimeType: 'image/jpeg', data: m.preview.toString('base64') } });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return normalizePlan(JSON.parse(text) as MvPlan, i);
  } catch (e) {
    log.warn(`plan by rule (${String(e).slice(0, 160)})`);
    return rulePlan(i);
  }
}
