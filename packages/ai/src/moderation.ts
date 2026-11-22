import { lookWishCategory } from '@obolo/shared';
import type { LlmProvider, ModerationResult } from './types';

/**
 * PLACEHOLDER (P-MOD-1): spec §8 makes LLM pre-publish moderation a launch blocker.
 * For the demo this is a minimal keyword screen + optional LLM check; the real policy,
 * categories, strike system and admin queue are not built yet.
 */
const BLOCKLIST = [/死ね/, /殺す/, /\bkill yourself\b/i];

export async function moderateText(text: string, llm?: LlmProvider): Promise<ModerationResult> {
  const hits = BLOCKLIST.filter((re) => re.test(text)).map((re) => re.source);
  if (hits.length) return { flagged: true, categories: ['harassment'] };
  if (!llm || llm.name === 'mock') return { flagged: false, categories: [] };
  try {
    const out = await llm.chat({
      system:
        'You are a strict content moderator for a social app used by minors. Reply with exactly "OK" or "FLAG:<category>" (harassment, sexual, violence, self_harm, hate, spam).',
      history: [{ role: 'user', text }],
      temperature: 0,
      maxOutputTokens: 20,
    });
    if (out.startsWith('FLAG')) return { flagged: true, categories: [out.split(':')[1]?.trim() || 'other'] };
  } catch {
    // Fail open in the demo; production should queue for human review instead (P-MOD-1).
  }
  return { flagged: false, categories: [] };
}

/**
 * {bati}'s look (M-R215): free per child (any art touch, dress-up), but never a real person's lookalike, another
 * work's character, a sexual or a violent look. The dress-up wish is screened here before it is painted (a word
 * list, then the general moderation, then — with a real model — a look-specific check). `categories`:
 * real_person / other_work / sexual / violent (or the general ones).
 */
export async function moderateLookWish(text: string, llm?: LlmProvider): Promise<ModerationResult> {
  const hit = lookWishCategory(text);
  if (hit) return { flagged: true, categories: [hit] };
  const general = await moderateText(text, llm);
  if (general.flagged) return general;
  if (!llm || llm.name === 'mock') return { flagged: false, categories: [] };
  try {
    const out = await llm.chat({
      system:
        'You check a child\'s wish for how their cute partner creature should look (Japanese). Reply with exactly "OK" or "FLAG:<category>". ' +
        'FLAG:real_person if it asks to look like a real, existing person (a celebrity, a politician, an athlete, a classmate by name). ' +
        'FLAG:other_work if it asks to look like a character, mascot or costume from an existing anime, game, film, book or brand. ' +
        'FLAG:sexual for anything sexual or revealing. FLAG:violent for weapons, blood, injuries or violence. ' +
        'Everything else is OK (clothes, colours, hats, wings, an art style such as watercolour or pixel art, animals, food, seasons).',
      history: [{ role: 'user', text }],
      temperature: 0,
      maxOutputTokens: 20,
    });
    if (out.trim().startsWith('FLAG')) return { flagged: true, categories: [out.split(':')[1]?.trim() || 'other'] };
  } catch {
    // the word list and the general check stand (P-MOD-1)
  }
  return { flagged: false, categories: [] };
}
