/**
 * How long one sentence of Bati's voice takes to make (story chat M-R179: Bati's answers read aloud — how soon
 * after the text). Times Gemini TTS (the story's character voice: Leda, the Bati brief) with the pro and flash
 * models, and Fish Audio (the shared default voice) when its key is set. Prints a table; nothing is saved.
 * Run by .github/workflows/tts-latency.yml.
 */
import { storyVoicePrompt } from '../../../packages/shared/src/storyVoice';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const BRIEF = "Bati: a tiny newborn magical creature, the player's partner; a cheerful, innocent, childlike voice, bright and bouncy, curious about everything, kind";
const LINES = [
  'ブラックホールって、重さがぎゅーっと集まって、光も出てこられない場所なんだって！',
  'うん、わかった！',
  '月は、地球のまわりを、だいたい27日かけて、ぐるっと回っているんだよ。',
];

async function gemini(model: string, text: string): Promise<{ ms: number; ok: boolean; note: string }> {
  const t0 = Date.now();
  const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ parts: [{ text: storyVoicePrompt(BRIEF, undefined, text) }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Leda' } } } } }),
  });
  const j = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
  const data = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData?.data;
  const sec = data ? Buffer.from(data, 'base64').length / 48000 : 0;
  return { ms: Date.now() - t0, ok: !!data, note: data ? `${sec.toFixed(1)}s of audio` : `status ${res.status}` };
}

async function fish(text: string): Promise<{ ms: number; ok: boolean; note: string }> {
  const t0 = Date.now();
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.FISH_API_KEY}`, 'content-type': 'application/json', model: process.env.FISH_MODEL || 's2.1-pro' },
    body: JSON.stringify({ text, reference_id: process.env.FISH_DEFAULT_VOICE_ID || undefined, format: 'mp3', latency: 'balanced' }),
  });
  const reader = res.body?.getReader();
  let first = 0;
  let bytes = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!first) first = Date.now() - t0;
    bytes += value.length;
  }
  return { ms: Date.now() - t0, ok: res.ok, note: res.ok ? `first sound ${first}ms, ${bytes} bytes` : `status ${res.status}` };
}

async function main() {
  const rows: string[] = ['| service | line | ms | result |', '|---|---|---|---|'];
  for (const model of ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']) {
    for (const [k, text] of LINES.entries()) {
      for (let n = 0; n < 2; n++) {
        const r = await gemini(model, text).catch((e) => ({ ms: 0, ok: false, note: String(e) }));
        rows.push(`| ${model} | ${k + 1} | ${r.ms} | ${r.note} |`);
      }
    }
  }
  if (process.env.FISH_API_KEY) {
    for (const [k, text] of LINES.entries()) {
      for (let n = 0; n < 2; n++) {
        const r = await fish(text).catch((e) => ({ ms: 0, ok: false, note: String(e) }));
        rows.push(`| fish | ${k + 1} | ${r.ms} | ${r.note} |`);
      }
    }
  }
  console.log(rows.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, rows.join('\n') + '\n');
}
void main();
