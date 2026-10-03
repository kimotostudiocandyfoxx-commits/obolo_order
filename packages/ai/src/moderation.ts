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
