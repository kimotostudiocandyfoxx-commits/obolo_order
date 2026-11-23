import { describe, expect, it } from 'vitest';
import type { HomeWork, PlanetHomeView } from '@obolo/shared';
import { menuFor, moveOwn, queueFrom, recordOrder, stageOf } from './model';

const now = Date.parse('2026-11-23T12:00:00Z');
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
const w = (id: string, rel: HomeWork['rel'], h: number, x: Partial<HomeWork> = {}): HomeWork => ({
  id,
  kind: 'saturn_post',
  author: { id: `u-${id}`, name: id },
  rel,
  text: id,
  url: `tts:${id}`,
  flownAt: ago(h),
  ...x,
});
const view = (x: Partial<PlanetHomeView>): PlanetHomeView => ({
  planet: 'saturn',
  live: true,
  owner: { id: 'me', name: 'ネオ' },
  young: false,
  lastVisitAt: ago(10),
  own: [],
  around: [],
  far: [],
  ...x,
});

describe('星のホーム stage', () => {
  it('only what came since the last visit sparkles; five fall alone, the rest in one 「＋」', () => {
    const around = [1, 2, 3, 4, 5, 6, 7].map((h) => w(`a${h}`, 'dachi', h));
    const s = stageOf(view({ around: [...around, w('old', 'oshi', 20)] }), {
      now,
    });
    expect(s.around.filter((x) => x.fresh).map((x) => x.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
    expect(s.around.filter((x) => x.drop === 'one').map((x) => x.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(s.around.filter((x) => x.drop === 'plus').map((x) => x.id)).toEqual(['a6', 'a7']);
    expect(s.around.find((x) => x.id === 'old')!.fresh).toBe(false);
    expect(s.plus).toBe(true);
    expect(s.firstTime).toBe(false);
  });
  it('a dachi’s work leaves when its 88 hours run out on screen; your own never does', () => {
    const s = stageOf(
      view({
        own: [w('o', 'own', 500)],
        around: [w('d', 'dachi', 88.01), w('k', 'oshi', 87)],
      }),
      { now },
    );
    expect(s.own[0].leaving).toBe(false);
    expect(s.around.map((x) => [x.id, x.leaving])).toEqual([
      ['k', false],
      ['d', true],
    ]);
  });
  it('the story seeds join around your place; hidden works go', () => {
    const s = stageOf(view({ around: [w('a', 'dachi', 1)] }), {
      now,
      seeds: [w('kimorin', 'dachi', 0.1, { demo: true }), w('a', 'dachi', 1)],
      hidden: new Set(['a']),
    });
    expect(s.around.map((x) => x.id)).toEqual(['kimorin']);
  });
  it('Saturn: the record newest first, a tap sings now and the record carries on', () => {
    const s = stageOf(
      view({
        own: [w('o', 'own', 30)],
        around: [w('d', 'dachi', 2), w('p', 'oshi', 5)],
      }),
      { now },
    );
    const order = recordOrder(s);
    expect(order.map((x) => x.id)).toEqual(['d', 'p', 'o']);
    expect(queueFrom(order, 'p').map((x) => x.id)).toEqual(['p', 'o', 'd']);
  });
  it('reorder and the long-press menus', () => {
    expect(moveOwn(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveOwn(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(menuFor({ rel: 'dachi' }, false)).toEqual(['open', 'hide', 'report']);
    expect(menuFor({ rel: 'oshi' }, false)).toEqual(['open', 'unpush', 'hide', 'report']);
    expect(menuFor({ rel: 'stranger' }, false)).toEqual(['open', 'push', 'hide', 'report']);
    expect(menuFor({ rel: 'stranger' }, true)).toEqual(['open', 'hide', 'report']);
    expect(menuFor({ rel: 'dachi', demo: true }, false)).toEqual([]);
  });
});
