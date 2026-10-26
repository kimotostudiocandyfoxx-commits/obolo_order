/**
 * Story voices with the member's names in them (client decision 2026-10-16): lines like 「{neo}、待ってた。」
 * are voiced for each member in the background once the names are known, in the same character voice
 * and with the same sound as the pre-made lines. The list of such lines (who / how / words / voice) is
 * written by apps/web/scripts/story-voices.ts to public/story/voices/name-lines.json whenever the
 * story changes, so the server always voices the current script.
 */

/** A character's voice: a Gemini voice (with pitch / echo / growl) or a Fish model made from a recording. */
export interface StoryVoiceSpec {
  voice?: string;
  fish?: string;
  model?: string;
  pitch?: number;
  echo?: number;
  growl?: number;
  formant?: 'preserved' | 'shifted';
  brief?: string;
  label?: string;
  /** this speaker's own speed on top of the story tempo (KIMORIN 0.85: calmer, client 2026-10-26) */
  tempo?: number;
}

/** public/story/voices/name-lines.json */
export interface NameLines {
  /** the Gemini text-to-speech model the pre-made lines were read with */
  model: string;
  tempo: number;
  /** by voiceKey(who, act, words-as-written) — also under the key without the stage direction */
  lines: Record<string, { who: string; act?: string; text: string; spec: StoryVoiceSpec; brief: string }>;
}

/** The names a line can hold. */
export interface StoryNames {
  name?: string;
  neo?: string;
  bati?: string;
  food?: string;
  inviter?: string;
}

/** The line with the member's names in it; null while a name it needs is not known yet. */
export function fillNames(text: string, n: StoryNames): string | null {
  const out = text.replace(/\{([a-z_]+)\}/g, (m, k: string) => {
    const v = k === 'name' ? n.name : k === 'neo' ? n.neo : k === 'bati' ? n.bati : k === 'food' ? n.food : k === 'inviter' ? n.inviter : undefined;
    return v?.trim() ? v.trim() : m;
  });
  return /\{[a-z_]+\}/.test(out) ? null : out;
}

/**
 * Names are written in hiragana, katakana or English letters (client decision 2026-10-16), so the voices
 * read them right. Spaces, ー, ・ and a few marks are fine.
 */
export const NAME_CHARS = /^[\p{Script=Hiragana}\p{Script=Katakana}ーｰ・A-Za-z0-9 　'’.\-☆⭐︎♪!！?？]+$/u;
export const nameCharsOk = (s: string) => NAME_CHARS.test(s.trim());

/**
 * The sound of a story voice, as an ffmpeg filter chain (the same for the pre-made lines and the
 * members' lines): no silence at the head, the character's pitch / echo / growl, the story's tempo,
 * an even level. ffmpeg's rubberband loses the last moment of a line and ends on a click, so a line
 * that is pitched gets a second of silence first; the click and the silence left over are trimmed.
 */
export function storyVoiceFilter(s: StoryVoiceSpec, tempo: number): string {
  const f: string[] = ['silenceremove=start_periods=1:start_duration=0:start_threshold=-42dB:start_silence=0.04'];
  const rb = (st: number, formant: string) =>
    [
      'apad=pad_dur=1',
      `rubberband=pitch=${Math.pow(2, st / 12).toFixed(4)}:formant=${formant}:pitchq=quality:transients=smooth:window=long:smoothing=on:phase=independent`,
      'areverse,atrim=start=0.25,asetpts=N/SR/TB',
      'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=0.12,areverse',
    ].join(',');
  // a small shift (OBOLON's 0.7): resample it — rubberband left little clicks that the echo then repeated
  // (2026-10-20: 「カチカチ」 under OBOLON); a resample changes the voice's size a hair, inaudible this close
  const small = !!s.pitch && Math.abs(s.pitch) <= 1.5 && !s.growl && s.formant !== 'shifted';
  if (small) {
    const r = Math.pow(2, s.pitch! / 12);
    f.push(`aresample=48000,asetrate=${(48000 * r).toFixed(2)},aresample=48000,atempo=${(1 / r).toFixed(5)}`);
  } else if (s.growl) {
    // a monster: formants pulled down with the pitch, grit, weight in the low end
    f.push(rb(s.pitch ?? -6, 'shifted'));
    f.push(`bass=g=${(6 * s.growl).toFixed(1)}:f=120`, `asoftclip=type=tanh:threshold=${(1 - 0.5 * s.growl).toFixed(2)}`, 'lowpass=f=7000');
  } else if (s.pitch && !small) f.push(rb(s.pitch, s.formant ?? 'preserved'));
  if (s.echo) {
    const d = (0.25 + 0.35 * s.echo).toFixed(2);
    f.push(`aecho=0.85:0.75:170|340:${d}|${(+d / 2).toFixed(2)}`);
  }
  const speed = tempo * (s.tempo ?? 1);
  if (Math.abs(speed - 1) >= 0.001) f.push(`atempo=${speed.toFixed(4)}`);
  f.push('loudnorm=I=-18:TP=-1.5');
  return f.join(',');
}

/**
 * The words as the voice should read them: roman words it gets wrong are given in kana (「obolo」 was read
 * as 「おぼろん」 — client 2026-10-20). Only what is spoken changes; the line on screen stays as written.
 */
export const STORY_READINGS: [RegExp, string][] = [[/(?<![A-Za-z])obolo(?![A-Za-z])/g, 'オボロ']];
export function speakText(text: string): string {
  return STORY_READINGS.reduce((t, [re, kana]) => t.replace(re, kana), text.replace(/\n/g, ' '));
}

/** What the Gemini voice is told before the line. */
export function storyVoicePrompt(brief: string, act: string | undefined, text: string): string {
  const how = act ? ` This time it is said ${act} (stage direction, in Japanese: 「${act}」).` : '';
  return `You are voicing a character in a Japanese anime adventure for children. ${brief}.${how} Speak only the Japanese line below, in character, naturally — do not read these instructions.\n\n${speakText(text)}`;
}
