/**
 * "ネオの声" — how an OBOLO NEO's post is read aloud on Saturn (client decision 2026-10-04:
 * NEO members post with the NEO voice; ORDER members can use their own registered voice).
 *
 * Today this uses the device's speech synthesis (pitch / rate / volume only), so whisper and shout
 * are approximations ("〜風"). PLACEHOLDER (P-VOICE-1): switch to an expressive TTS (e.g. Gemini TTS
 * with style prompts) rendered server-side to an audio file; the style ids below stay the same.
 */
export interface VoiceStyle {
  id: string;
  label: string;
  rate: number; // 0.1–10 (1 = normal)
  pitch: number; // 0–2 (1 = normal)
  volume: number; // 0–1
  /** the same style for a registered voice read by Fish Audio: inline tag + prosody speed */
  fish: { tag: string; speed: number };
}

export const VOICE_STYLES: readonly VoiceStyle[] = [
  { id: 'genki', label: '元気に', rate: 1.15, pitch: 1.35, volume: 1, fish: { tag: '[excited]', speed: 1.05 } },
  { id: 'yukkuri', label: 'ゆっくり', rate: 0.72, pitch: 1, volume: 1, fish: { tag: '[calm]', speed: 0.8 } },
  { id: 'hayakuchi', label: '早口', rate: 1.65, pitch: 1.1, volume: 1, fish: { tag: '[hurried]', speed: 1.4 } },
  { id: 'hikui', label: '低い声で', rate: 0.95, pitch: 0.55, volume: 1, fish: { tag: '[low voice]', speed: 0.95 } },
  { id: 'takai', label: '高い声で', rate: 1.05, pitch: 1.85, volume: 1, fish: { tag: '[high-pitched voice]', speed: 1.05 } },
  { id: 'sasayaki', label: 'ささやき風', rate: 0.82, pitch: 1.15, volume: 0.4, fish: { tag: '[whispering]', speed: 0.9 } },
  { id: 'sakebu', label: '叫ぶ風', rate: 1.25, pitch: 1.6, volume: 1, fish: { tag: '[shouting]', speed: 1.1 } },
];

export const VOICE_STYLE_IDS = VOICE_STYLES.map((s) => s.id) as [string, ...string[]];

/** Each NEO form sounds a little different (multiplies the style's pitch). */
export const NEO_PITCH: Record<string, number> = {
  kitsune: 1.1,
  usagi: 1.25,
  neko: 1.15,
  ookami: 0.85,
  fukurou: 0.95,
  ryu: 0.75,
  kuma: 0.7,
  shika: 1.05,
};

/** Voice URL for a NEO-voice post: tts:<style>.<neo>:<text> */
export function neoVoiceUrl(style: string, neo: string | null | undefined, text: string): string {
  return `tts:${style}.${neo ?? 'none'}:${text}`;
}

/** Parses tts URLs: "tts:<style>.<neo>:<text>" (NEO voice) or legacy "tts:<text>". */
export function parseTtsUrl(url: string): { style?: VoiceStyle; neo?: string; text: string } | null {
  if (!url.startsWith('tts:')) return null;
  const m = /^tts:([a-z]+)\.([a-z]+):([\s\S]*)$/.exec(url);
  if (m) {
    const style = VOICE_STYLES.find((s) => s.id === m[1]);
    if (style) return { style, neo: m[2], text: m[3] };
  }
  return { text: url.slice(4) };
}
