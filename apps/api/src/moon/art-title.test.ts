import 'reflect-metadata';
import { ArtTitleBody, spellFrom } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { featureOfPath } from '../wallet/cost-scope';
import { ArtTitleService } from './art-title.service';

const tags = spellFrom('art', '夕焼けの町を水彩で');
const writer = (answer: string | (() => Promise<string>)) => {
  const calls: { system: string; text: string; json?: boolean }[] = [];
  return {
    calls,
    llm: { name: 'test', chat: async (r: { system: string; json?: boolean; history: { text: string }[] }) => (calls.push({ system: r.system, text: r.history[0].text, json: r.json }), typeof answer === 'string' ? answer : answer()) },
  };
};
const svc = (w: { llm: unknown }) => new ArtTitleService(w.llm as never);

describe('story 2026-11-25: POST /moon/art-title', () => {
  it("one title from the picture's spell, by the song name's writer (JSON, the spell's words in the ask)", async () => {
    const w = writer('```json\n{"title":"「茜の町」"}\n```');
    const v = await svc(w).title(ArtTitleBody.parse({ tags, said: '夕焼けの町を水彩で' }));
    expect(v).toEqual({ title: '茜の町', how: 'writer' });
    expect(w.calls).toHaveLength(1);
    expect(w.calls[0].json).toBe(true);
    expect(w.calls[0].text).toContain('夕焼けの町を水彩で');
    expect(w.calls[0].system).toMatch(/ONE short/);
  });
  it('another one: the title now goes with the ask, and the same one is never given back', async () => {
    const w = writer('{"title":"茜の町"}');
    const v = await svc(w).title(ArtTitleBody.parse({ tags, said: '夕焼けの町', before: '茜の町' }));
    expect(w.calls[0].text).toContain('「茜の町」');
    expect(v.how).toBe('rule');
    expect(v.title).not.toBe('茜の町');
  });
  it('the writer failing is no failure: a title by rule', async () => {
    const v = await svc(writer(() => Promise.reject(new Error('down')))).title(ArtTitleBody.parse({ tags, said: '夕焼けの町を水彩で' }));
    expect(v.how).toBe('rule');
    expect(v.title.length).toBeGreaterThan(0);
  });
  it('a title that breaks the rules is never given (by rule instead)', async () => {
    const v = await svc(writer('{"title":"死ね"}')).title(ArtTitleBody.parse({ tags, said: 'ねこ' }));
    expect(v.how).toBe('rule');
    expect(v.title).not.toBe('死ね');
  });
  it("booked as a song's name is: the lyrics feature's small cost", () => {
    expect(featureOfPath('/moon/art-title')).toBe('lyrics');
    expect(featureOfPath('/moon/lyrics')).toBe('lyrics');
  });
});
