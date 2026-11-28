/**
 * The words a speech model heard, without what it writes when there is no speech (client R21 playtest, 2026-11-28,
 * iPhone Safari, day 2's favourite food: both takes came back as 「00:00」 / noise and stood in the answer).
 *
 * The model behind POST /voice/dictate (Gemini) answers a take with no voice in it (silence, the room's hiss, music)
 * with a timestamp (「00:00」「[00:00 - 00:04]」), a sound tag (「[音楽]」「（ノイズ）」「♪」) or a sentence saying so
 * (「音声なし」「No speech」) — not with an empty string, whatever the prompt says. Those are not the member's words:
 * they are taken out here, and what is left (nothing, for such a take) is what the mic gets. Used by the API
 * (dictate, transcribe) and again by the web (lib/mic/hear.ts).
 */

/** a timestamp or a range of them: 0:00, 00:00, 00:00:03, 00:00.5, 00:00 - 00:04, 0:00〜0:05 */
const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?`;
const RANGE = String.raw`${TIME}(?:\s*(?:-|–|—|〜|~|→|to)\s*${TIME})?`;
/** in brackets it is always the model's mark (「[00:00]」「(0:00〜0:05)」), wherever it stands */
const BRACKETED_TIME = new RegExp(String.raw`[\[(（【〔<]\s*${RANGE}\s*[\])）】〕>]`, 'g');
/** bare, only at the very start (「00:00 こんにちは」, a transcript's line mark); a time said in a sentence stays */
const LEADING_TIME = new RegExp(String.raw`^(?:${RANGE}\s*[:：\-–—]?\s+)+`);
/** the whole answer is timestamps (and marks): no speech */
const ONLY_TIMES = new RegExp(String.raw`^(?:[\s\p{P}\p{S}]*${RANGE})+[\s\p{P}\p{S}]*$`, 'u');

/** what a sound tag is about, in brackets: [音楽] （ノイズ） 【無音】 (music) [inaudible] … */
const TAG_WORDS =
  '音楽|BGM|ＢＧＭ|ノイズ|雑音|無音|沈黙|静寂|音声なし|音声無し|音声がありません|発話なし|話し声なし|聞き取れない|聞き取り不能|不明瞭|拍手|笑い|笑|咳|咳払い|ため息|息|呼吸|環境音|物音|風の音|機械音|電子音|効果音|空白|なし|music|noise|background noise|silence|silent|no speech|inaudible|unintelligible|applause|laughter|laughs|cough|breathing|static|blank|none';
const SOUND_TAG = new RegExp(String.raw`[\[(（【〔<]\s*(?:${TAG_WORDS})(?:\s*[・、,/]\s*(?:${TAG_WORDS}))*\s*[\])）】〕>]`, 'gi');

/**
 * a whole answer that only says there was nothing to hear (narrow on purpose: 「音楽」 or 「なし」 can be what someone
 * really said; 「無音」「音声なし」 hardly)
 */
const NOTHING = new RegExp(
  String.raw`^(?:ノイズ|雑音|無音|音声なし|音声無し|音声がありません|発話なし|聞き取れない|聞き取り不能|noise|background noise|silence|no speech|inaudible|何も(?:話して|聞こえて|言って)(?:い)?ません(?:でした)?|話し声は(?:ありません|聞こえません)(?:でした)?|音声が(?:含まれて|入って)いません(?:でした)?|ご視聴ありがとうございました)$`,
  'i',
);

/** nothing but marks, music notes and spaces */
const ONLY_MARKS = /^[\s\p{P}\p{S}ー〜~…・]*$/u;

/** the member's words in what the model answered ('' when it heard no speech at all) */
export function cleanHeard(raw: string): string {
  let s = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(SOUND_TAG, ' ').replace(BRACKETED_TIME, ' ').replace(/[♪♫♬]/g, ' ').replace(/\s+/g, ' ').trim();
  if (ONLY_TIMES.test(s)) return '';
  s = s.replace(LEADING_TIME, '').trim();
  if (!s || ONLY_MARKS.test(s)) return '';
  if (NOTHING.test(s.replace(/[。．.！!、,]+$/u, '').trim())) return '';
  return s;
}

/** the model answered something, but none of it was speech (the take was silence or noise: worth reporting) */
export function heardNoSpeech(raw: string): boolean {
  return !!(raw ?? '').trim() && !cleanHeard(raw);
}
