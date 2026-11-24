'use client';

import { talkPlain } from '@obolo/shared';
import { getApi } from '@/lib/api';

/**
 * Client 2026-11-24: {bati} speaks its replies in the Moon chat, through the same voice path as the story chat
 * (POST /voice/bati-says → the member's own Fish model, else FISH_DEFAULT_VOICE_ID, else the Gemini voice). Long replies
 * are read only up to SPEAK_MAX characters (cut at the last sentence end before it); the same words are fetched once
 * (here for the page, and the server keeps the file a day — it also counts every voice toward the day's read-aloud
 * limit). Played on the app's one AudioContext (webVoice playClip), so it follows the silent switch (M-R239), the first-
 * tap unlock and the talk's own sound button (TalkScene's mute: talkMuted()).
 */
export const SPEAK_MAX = 120;

/** the words to read: the marks taken off (M-R243), at most SPEAK_MAX characters, ending at a sentence if one ends in it */
export function speakable(text: string): string {
  const t = talkPlain(text).replace(/\s+/g, ' ').trim();
  if (t.length <= SPEAK_MAX) return t;
  const cut = t.slice(0, SPEAK_MAX);
  const end = Math.max(...['。', '！', '？', '!', '?', '…'].map((c) => cut.lastIndexOf(c)));
  return end >= 20 ? cut.slice(0, end + 1) : cut;
}

const cache = new Map<string, Promise<string | null>>();
/** the voice file of these words (null: no voice now — the words alone) */
export function batiVoiceUrl(words: string): Promise<string | null> {
  let p = cache.get(words);
  if (!p) {
    p = getApi()
      .batiSays(words)
      .then((r) => r.url)
      .catch(() => null);
    // a failure is tried again next time
    void p.then((u) => u || cache.delete(words));
    cache.set(words, p);
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
  }
  return p;
}
