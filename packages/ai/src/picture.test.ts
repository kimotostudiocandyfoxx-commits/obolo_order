import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPictureProvider, GeminiImageProvider, MockImageProvider, RunwareImageProvider, runwareImageTask, runwareRefMode } from './images';
import { moderateText } from './moderation';

describe('R17: each picture use paints on the model of its config', () => {
  it('a Runware AIR id → Runware on that model; a Gemini image model → Gemini; no key → the next that works', () => {
    const klein = createPictureProvider('runware:400@4', { runwareKey: 'rk', geminiApiKey: 'gk' });
    expect(klein).toBeInstanceOf(RunwareImageProvider);
    expect((klein as RunwareImageProvider).model).toBe('runware:400@4');
    expect(createPictureProvider('bytedance:seedream@5.0-pro', { runwareKey: 'rk' }).name).toBe('seedream');
    expect(createPictureProvider('gemini-2.5-flash-image', { runwareKey: 'rk', geminiApiKey: 'gk' })).toBeInstanceOf(GeminiImageProvider);
    // a Runware model without the Runware key: Gemini's picture model, or the offline mock
    expect(createPictureProvider('runware:400@4', { geminiApiKey: 'gk' })).toBeInstanceOf(GeminiImageProvider);
    expect(createPictureProvider('runware:400@4', {})).toBeInstanceOf(MockImageProvider);
  });
  it('every task asks for its cost; the references go the way the model takes them', () => {
    const ref = { data: Buffer.from('x'), mime: 'image/jpeg' };
    const k = runwareImageTask('runware:400@4', 't1', 'p', 1024, [ref, ref, ref, ref, ref, ref]);
    expect(k).toMatchObject({ taskType: 'imageInference', model: 'runware:400@4', includeCost: true, width: 1024 });
    expect((k.referenceImages as string[]).length).toBe(4);
    const sdxl = runwareImageTask('civitai:827184@1761560', 't2', 'p', 1024, [ref]);
    expect(sdxl.ipAdapters).toHaveLength(1);
    expect(sdxl.referenceImages).toBeUndefined();
    expect(sdxl.includeCost).toBe(true);
    const words = runwareImageTask('runware:z-image@turbo', 't3', 'p', 1024, [ref]);
    expect(words.referenceImages).toBeUndefined();
    expect(runwareRefMode('bytedance:seedream@5.0-pro')).toEqual({ mode: 'refs', max: 10 });
  });
});

describe('R17: the same words are moderated once', () => {
  afterEach(() => vi.restoreAllMocks());
  it('a second check of the same text does not ask the model again; an error is not kept', async () => {
    const chat = vi.fn(async () => 'OK');
    const llm = { name: 'gemini-test', chat };
    await moderateText('きらきらの星を集めるゲーム', llm);
    await moderateText('きらきらの星を集めるゲーム', llm);
    expect(chat).toHaveBeenCalledTimes(1);
    const broken = { name: 'gemini-broken', chat: vi.fn(async () => Promise.reject(new Error('down'))) };
    await moderateText('ねこ', broken);
    await moderateText('ねこ', broken);
    expect(broken.chat).toHaveBeenCalledTimes(2);
  });
});
