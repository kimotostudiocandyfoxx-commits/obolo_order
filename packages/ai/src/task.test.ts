import { describe, expect, it } from 'vitest';
import { FallbackProvider } from './providers';
import { createTaskLlm, parseModelSpec, TASK_MODEL_DEFAULTS, TimeoutProvider } from './task';

describe('per-task models (NOVEL_MODEL / GAME_MODEL)', () => {
  it('a spec is a chain of provider:model', () => {
    expect(parseModelSpec(TASK_MODEL_DEFAULTS.game)).toEqual([
      { provider: 'gemini', model: 'gemini-2.5-pro' },
      { provider: 'gemini', model: 'gemini-2.5-flash' },
    ]);
    expect(parseModelSpec('claude:claude-haiku-5-5, gemini:gemini-2.5-flash')).toEqual([
      { provider: 'claude', model: 'claude-haiku-5-5' },
      { provider: 'gemini', model: 'gemini-2.5-flash' },
    ]);
    expect(parseModelSpec('anthropic:x,junk')).toEqual([{ provider: 'claude', model: 'x' }]);
  });
  it('steps without a key are skipped; nothing usable is the offline mock', () => {
    expect(createTaskLlm(TASK_MODEL_DEFAULTS.game, {}).name).toBe('mock');
    const g = createTaskLlm(TASK_MODEL_DEFAULTS.game, { geminiApiKey: 'k' }, { timeoutMs: 1000 });
    expect(g).toBeInstanceOf(FallbackProvider);
    expect(g.name).toBe('gemini:gemini-2.5-pro>gemini:gemini-2.5-flash');
    expect(createTaskLlm('claude:claude-haiku-5-5,gemini:gemini-2.5-flash', { geminiApiKey: 'k' }).name).toBe('gemini:gemini-2.5-flash');
  });
  it('a slow step gives way to the next (Pro → Flash)', async () => {
    const slow = { name: 'slow', chat: () => new Promise<string>((r) => setTimeout(() => r('late'), 200)) };
    const fast = { name: 'fast', chat: async () => 'ok' };
    const chain = new FallbackProvider([new TimeoutProvider(slow, 20), fast]);
    expect(await chain.chat({ system: '', history: [] })).toBe('ok');
  });
});
