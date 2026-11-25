import { afterEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeProvider } from './claude';
import { SeedreamImageProvider } from './images';
import { meterGemini, meterRunware, setCostSink, timed, type CostEvent } from './meter';

const capture = () => {
  const got: CostEvent[] = [];
  setCostSink((e) => got.push(e));
  return got;
};

afterEach(() => {
  setCostSink(null);
  vi.unstubAllGlobals();
});

describe('cost metering', () => {
  it('Runware: the cost each result carries (exact); a missing one priced from the table', () => {
    const got = capture();
    meterRunware('runware:400@4', [{ cost: 0.0011 }, { cost: 0.0013 }]);
    expect(got[0]).toMatchObject({ provider: 'runware', model: 'runware:400@4', exact: true, units: { results: 2 } });
    expect(got[0].usd).toBeCloseTo(0.0024, 10);
    meterRunware('runware:400@4', [{ cost: 0.001 }, {}]);
    expect(got[1].exact).toBe(false);
    expect(got[1].usd).toBeCloseTo(0.0022, 10);
  });
  it('Seedream asks Runware for the cost and reports it', async () => {
    const got = capture();
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { body?: string }) => {
        if (url === 'https://api.runware.ai/v1') {
          bodies.push(JSON.parse(init!.body!));
          return new Response(JSON.stringify({ data: [{ imageURL: 'https://img/x.jpg', cost: 0.0375 }] }), { status: 200 });
        }
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }),
    );
    await new SeedreamImageProvider('k').generate('a cat');
    expect((bodies[0] as { includeCost?: boolean }[])[0].includeCost).toBe(true);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ provider: 'runware', model: 'bytedance:seedream@5.0-pro', usd: 0.0375, exact: true });
  });
  it('Gemini: usageMetadata × the model price', () => {
    const got = capture();
    meterGemini('gemini-2.5-flash', { promptTokenCount: 2000, candidatesTokenCount: 300, thoughtsTokenCount: 700 });
    expect(got[0].usd).toBeCloseTo((2000 * 0.3 + 1000 * 2.5) / 1e6, 12);
    expect(got[0].units).toMatchObject({ in: 2000, out: 1000 });
    meterGemini('gemini-2.5-flash', undefined);
    expect(got).toHaveLength(1);
  });
  it('Claude: the usage of the answer', async () => {
    const got = capture();
    const msg = { content: [{ type: 'text', text: 'やあ' }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 200 } };
    const client = { messages: { create: vi.fn(async () => msg) } } as unknown as Anthropic;
    await new ClaudeProvider('k', 'claude-haiku-5-5', client).chat({ system: 's', history: [{ role: 'user', text: 'hi' }] });
    expect(got[0]).toMatchObject({ provider: 'claude', model: 'claude-haiku-5-5', exact: true });
    expect(got[0].usd).toBeCloseTo((3000 * 0.1 + 200 * 0.5) / 1e6, 12);
  });
  it('our machine time: seconds reported even when the work fails', async () => {
    const got = capture();
    await expect(timed('gpu', 'music', () => new Promise((_, no) => setTimeout(() => no(new Error('x')), 15)))).rejects.toThrow('x');
    expect(got[0]).toMatchObject({ provider: 'gpu', model: 'music' });
  });
  it('a failing sink never breaks the work', () => {
    setCostSink(() => {
      throw new Error('db down');
    });
    expect(() => meterRunware('m', [{ cost: 1 }])).not.toThrow();
  });
});
