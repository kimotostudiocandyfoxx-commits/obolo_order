import { Logger } from '@nestjs/common';

/**
 * Bati's MV edit plan (client decision 2026-10-08: Gemini Flash-Lite). It looks at the materials
 * (a picture of each) and the song (length, tempo, lyric lines with their times) and decides
 * which material goes where, for how long, with what motion, and which get the anime look.
 * Without a Gemini key (or if the answer is unusable) a plan is made by rule: cuts on the beat.
 */
export type MvMotion = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'still';
export type MvSegment = { m: number; dur: number; from: number; motion: MvMotion; anime: boolean };
export type MvPlan = { note: string; segments: MvSegment[] };

export type PlanMaterial = { kind: 'photo' | 'video'; seconds: number | null; preview: Buffer | null };
export type PlanInput = { title: string; seconds: number; bpm: number; lyrics: { t: number; text: string }[]; materials: PlanMaterial[] };

const MOTIONS: MvMotion[] = ['zoom-in', 'pan-left', 'zoom-out', 'pan-right'];
const log = new Logger('MvPlan');

/** One cut every 4 beats (≈ 2 s), the materials in turn, every motion in turn. */
export function rulePlan(i: PlanInput): MvPlan {
  const beat = 60 / (i.bpm || 100);
  const cut = Math.min(4, Math.max(1.6, beat * 4));
  const segments: MvSegment[] = [];
  let t = 0;
  let k = 0;
  while (t < i.seconds - 0.05) {
    const m = k % i.materials.length;
    const mat = i.materials[m];
    const dur = Math.min(cut, i.seconds - t);
    const from = mat.kind === 'video' && mat.seconds ? (k * 1.7) % Math.max(0.01, mat.seconds - dur) || 0 : 0;
    segments.push({ m, dur, from, motion: mat.kind === 'video' ? 'still' : MOTIONS[k % MOTIONS.length], anime: true });
    t += dur;
    k++;
  }
  return { note: '曲のリズムに合わせて、素材を順番に切りかえたよ。', segments };
}

/** Make any plan safe to render: known materials, sane lengths, exactly the song's length. */
export function normalizePlan(p: MvPlan, i: PlanInput): MvPlan {
  const segs: MvSegment[] = [];
  let t = 0;
  for (const s of p.segments ?? []) {
    if (t >= i.seconds - 0.05) break;
    const m = Number.isInteger(s.m) && s.m >= 0 && s.m < i.materials.length ? s.m : segs.length % i.materials.length;
    const mat = i.materials[m];
    const dur = Math.min(Math.max(Number(s.dur) || 2, 1.2), 8, i.seconds - t);
    const maxFrom = mat.kind === 'video' && mat.seconds ? Math.max(0, mat.seconds - dur) : 0;
    const from = Math.min(Math.max(Number(s.from) || 0, 0), maxFrom);
    const motion = (MOTIONS as string[]).includes(s.motion) || s.motion === 'still' ? s.motion : 'zoom-in';
    segs.push({ m, dur, from, motion, anime: s.anime !== false });
    t += dur;
  }
  // too short: keep going with the rule plan's rhythm
  if (t < i.seconds - 0.05) {
    const rest = rulePlan({ ...i, seconds: i.seconds - t }).segments.map((s, k) => ({ ...s, m: (segs.length + k) % i.materials.length }));
    segs.push(...rest);
  }
  return { note: (p.note || '').slice(0, 160) || rulePlan(i).note, segments: segs };
}

/** Ask Gemini (Flash-Lite) for the plan; falls back to the rule plan. */
export async function planMv(i: PlanInput, apiKey: string | undefined, model: string): Promise<MvPlan> {
  if (!apiKey) return rulePlan(i);
  const parts: Record<string, unknown>[] = [
    {
      text: [
        'You edit a short music video (square, for a kids-friendly music app) from the materials below.',
        `Song: "${i.title}", ${i.seconds.toFixed(1)} seconds, ${Math.round(i.bpm)} BPM.`,
        i.lyrics.length ? `Lyric lines (start second: text):\n${i.lyrics.map((l) => `${l.t.toFixed(1)}: ${l.text}`).join('\n')}` : 'No lyrics.',
        `Materials (index: kind, length): ${i.materials.map((m, k) => `${k}: ${m.kind}${m.seconds ? ` ${m.seconds.toFixed(1)}s` : ''}`).join(', ')}. A picture of each follows in order.`,
        'Plan the cuts so they land on the beat (multiples of one beat = 60/BPM seconds), match each material to the mood of the lyric line it plays under, use every material at least once, put the strongest picture on the chorus, and vary the motion.',
        'Return JSON only: {"note": "one friendly sentence in Japanese (casual, like a buddy) about how you edited it", "segments": [{"m": material index, "dur": seconds, "from": start second inside a video (0 for photos), "motion": "zoom-in"|"zoom-out"|"pan-left"|"pan-right"|"still" (videos usually "still"), "anime": true|false}]}.',
        `The durations must add up to ${i.seconds.toFixed(1)} seconds.`,
      ].join('\n'),
    },
  ];
  for (const m of i.materials) if (m.preview) parts.push({ inlineData: { mimeType: 'image/jpeg', data: m.preview.toString('base64') } });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 4096 } }),
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
