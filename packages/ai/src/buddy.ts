import type { BuddyPersona, Locale } from '@obolo/shared';
import { BATI_CHARACTER, personaToneLines } from './prompts/bati';
import { MEMORY_SUMMARY_PROMPT } from './prompts/memory';
import type { ChatTurn, LlmProvider } from './types';

export interface BuddyContext {
  buddyName: string;
  persona: BuddyPersona;
  memorySummary: string | null;
  userDisplayName: string;
  locale: Locale;
}

/** System prompt = character layer + tone sliders + long-term memory (spec §2.2). */
export function buildBuddySystemPrompt(ctx: BuddyContext): string {
  const parts = [BATI_CHARACTER[ctx.locale].replaceAll('{name}', ctx.buddyName), personaToneLines(ctx.persona, ctx.locale)];
  parts.push(ctx.locale === 'ja' ? `ユーザーの呼び名: ${ctx.userDisplayName}` : `Call the user: ${ctx.userDisplayName}`);
  if (ctx.memorySummary) {
    parts.push(
      ctx.locale === 'ja'
        ? `【これまでの会話で覚えていること】\n${ctx.memorySummary}`
        : `[What you remember from earlier conversations]\n${ctx.memorySummary}`,
    );
  }
  parts.push(ctx.locale === 'ja' ? '必ず日本語で返事をする。' : 'Always reply in English.');
  return parts.join('\n\n');
}

export async function buddyReply(llm: LlmProvider, ctx: BuddyContext, history: ChatTurn[]): Promise<string> {
  return llm.chat({ system: buildBuddySystemPrompt(ctx), history, temperature: 0.9, maxOutputTokens: 600 });
}

/** Condense existing memory + recent turns into an updated bullet list. */
export async function summarizeMemory(
  llm: LlmProvider,
  locale: Locale,
  existing: string | null,
  turns: ChatTurn[],
): Promise<string> {
  const transcript = turns.map((t) => `${t.role === 'user' ? 'USER' : 'BUDDY'}: ${t.text}`).join('\n');
  const input = `${locale === 'ja' ? '既存の記憶' : 'Existing memory'}:\n${existing || '-'}\n\n${
    locale === 'ja' ? '新しい会話' : 'New conversation'
  }:\n${transcript}`;
  const out = await llm.chat({
    system: MEMORY_SUMMARY_PROMPT[locale],
    history: [{ role: 'user', text: input }],
    temperature: 0.2,
    maxOutputTokens: 600,
  });
  return out.slice(0, 4000);
}
