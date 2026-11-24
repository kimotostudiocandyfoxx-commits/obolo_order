import { describe, expect, it } from 'vitest';
import { HOME_PLANETS, PLANET_HOMES, type HomeWork, type PlanetHomeView } from '@obolo/shared';
import { dockButtons, groovesOf, menuFor, moveOwn, queueFrom, recordOrder, rollingOf, stageOf } from './model';

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
  it('M-R259: what rolls — new and unheard (88 hours), at most twelve; heard ones and your older ones are in the grooves', () => {
    const around = Array.from({ length: 14 }, (_, i) => w(`a${i}`, i % 2 ? 'oshi' : 'dachi', 1 + i));
    const s = stageOf(view({ own: [w('mine-new', 'own', 0.5), w('mine-old', 'own', 200)], around }), { now });
    const heard = new Set(['a0', 'a1']);
    const roll = rollingOf(s, heard, now);
    expect(roll).toHaveLength(12);
    expect(roll[0].id).toBe('mine-new');
    expect(roll.map((x) => x.id)).not.toContain('a0');
    expect(roll.map((x) => x.id)).not.toContain('mine-old');
    const g = groovesOf(s, roll).map((x) => x.id);
    expect(g).toContain('a0');
    expect(g).toContain('mine-old');
    expect(g).not.toContain('mine-new');
    // everything heard: nothing rolls, all in the grooves
    const all = new Set([...s.own, ...s.around].map((x) => x.id));
    expect(rollingOf(s, all, now)).toEqual([]);
    expect(groovesOf(s, []).length).toBe(16);
  });
  it('M-R263: one big button per planet — Saturn 〔▶ 全部流す〕 (〔■ 止める〕 while it plays), every other 〔中に入る〕; no 〔＋ 飛ばす〕', () => {
    for (const p of HOME_PLANETS) {
      const b = dockButtons(PLANET_HOMES[p], false);
      expect(b).toHaveLength(1);
      expect(b[0].label).toBe(p === 'saturn' ? '▶ 全部流す' : '中に入る');
      expect(b.some((x) => /飛ばす/.test(x.label))).toBe(false);
    }
    expect(dockButtons(PLANET_HOMES.saturn, true)).toEqual([{ label: '■ 止める', act: 'stop' }]);
  });
});
