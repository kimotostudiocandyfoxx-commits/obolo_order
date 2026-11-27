import { describe, expect, it } from 'vitest';
import { liveHomeShows } from '../planetTemplate/sample';
import { storyHome } from '../planetTemplate/storyCast';
import { DAY3, DAY3_BEFORE, DAY3_NEW_HOME } from './day3';
import { DAY4, DAY4_BEFORE, DAY4_NEW_HOME } from './day4';
import { DAY5, DAY5_BEFORE, DAY5_NEW_HOME } from './day5';
import { DAY6, DAY6_BEFORE, DAY6_NEW_HOME } from './day6';
import { DAY7, DAY7_BEFORE, DAY7_NEW_HOME } from './day7';
import { D3_GROOVE_BEFORE, D3_GROOVE_NOW } from './newHomeScenes';
import type { Step } from './script';
import { STORIES, STORIES_NEW_HOMES } from './stories';

const says = (steps: Step[]) => steps.flatMap((s) => (s.t === 'say' ? [s.text] : []));
const homes = (steps: Step[]) => steps.flatMap((s) => (s.t === 'home' ? [`${s.planet}:${s.place}:${s.until ?? 'next'}`] : []));
const labels = (steps: Step[]) => steps.flatMap((s) => (s.t === 'label' ? [s.id] : []));
const targets = (steps: Step[]) => steps.flatMap((s) => (s.t === 'goto' ? [s.id] : s.t === 'branch' ? [...Object.values(s.cases), ...(s.otherwise ? [s.otherwise] : [])] : []));

describe('story days 3–7 and the planet switch (M-R330)', () => {
  it('switch off (this build, production today): every day plays its steps of before, unchanged', () => {
    expect(DAY3).toBe(DAY3_BEFORE);
    expect(DAY4).toBe(DAY4_BEFORE);
    expect(DAY5).toBe(DAY5_BEFORE);
    expect(DAY6).toBe(DAY6_BEFORE);
    expect(DAY7).toBe(DAY7_BEFORE);
    expect(STORIES[4].steps).toBe(DAY4_BEFORE);
    expect(says(DAY3_BEFORE)).toContain(D3_GROOVE_BEFORE);
    // the days of before open no planet home but Saturn's two (the home of before)
    expect(homes(DAY3_BEFORE)).toEqual(['saturn:takoyaki:next', 'saturn:neo:next']);
    for (const d of [DAY4_BEFORE, DAY5_BEFORE, DAY6_BEFORE, DAY7_BEFORE]) expect(homes(d)).toEqual([]);
  });

  it('switch on: Saturn tells the play button as dropping onto the record; the other days open the resident’s place, then {neo}’s (door)', () => {
    expect(says(DAY3_NEW_HOME)).toContain(D3_GROOVE_NOW);
    expect(says(DAY3_NEW_HOME)).not.toContain(D3_GROOVE_BEFORE);
    expect(DAY3_NEW_HOME).toHaveLength(DAY3_BEFORE.length + 1);
    expect(homes(DAY4_NEW_HOME)).toEqual(['jupiter:host:next', 'jupiter:neo:door']);
    expect(homes(DAY5_NEW_HOME)).toEqual(['mercury:host:next', 'mercury:neo:door']);
    expect(homes(DAY6_NEW_HOME)).toEqual(['mars:host:next', 'mars:neo:door']);
    expect(homes(DAY7_NEW_HOME)).toEqual(['venus:host:next', 'venus:neo:door']);
    expect(STORIES_NEW_HOMES[6].steps).toBe(DAY6_NEW_HOME);
    // 〔推す〕 → ♡ and the two-finger pinch are told; no 〔…をタップする〕 button of before is left on the planet
    for (const d of [DAY4_NEW_HOME, DAY5_NEW_HOME, DAY6_NEW_HOME, DAY7_NEW_HOME]) {
      const notes = d.flatMap((s) => (s.t === 'notice' ? [s.text] : []));
      expect(notes.some((t) => t.includes('2本の指でつまむと') && t.includes('♡を押すと'))).toBe(true);
      expect(d.some((s) => s.t === 'action' && /自分の(蝶|船|UFO|ラジオ)/.test(s.label))).toBe(false);
    }
  });

  it('every jump of the new days lands on a label that exists, once; each day still ends, stamps its ticket and keeps its scenes', () => {
    const scenes = (d: Step[]) => d.flatMap((s) => (s.t === 'scene' ? [s.id] : []));
    for (const [before, now] of [
      [DAY3_BEFORE, DAY3_NEW_HOME],
      [DAY4_BEFORE, DAY4_NEW_HOME],
      [DAY5_BEFORE, DAY5_NEW_HOME],
      [DAY6_BEFORE, DAY6_NEW_HOME],
      [DAY7_BEFORE, DAY7_NEW_HOME],
    ] as const) {
      const ls = labels(now);
      expect(new Set(ls).size).toBe(ls.length);
      for (const t of targets(now)) expect(ls).toContain(t);
      expect(scenes(now)).toEqual(scenes(before));
      expect(now.filter((s) => s.t === 'ticket')).toEqual(before.filter((s) => s.t === 'ticket'));
      expect(now.filter((s) => s.t === 'set')).toEqual(before.filter((s) => s.t === 'set'));
      expect(now.filter((s) => s.t === 'clock')).toEqual(before.filter((s) => s.t === 'clock'));
      expect(now[now.length - 1]).toEqual({ t: 'end' });
    }
  });

  it('the cast the script names: the resident’s place has KIMORIN⭐︎ (pushed) and MONBAN; {neo}’s has the inviter (or MIKIE⭐︎DRILL) and KIMORIN⭐︎', () => {
    for (const planet of ['saturn', 'jupiter', 'mercury', 'mars', 'venus'] as const) {
      const host = storyHome(planet, planet === 'saturn' ? 'takoyaki' : 'host', { neo: 'ミナト' });
      expect(host.own).toEqual([]);
      expect(host.around.map((w) => w.author.name).slice(0, 2)).toEqual(['KIMORIN⭐︎', 'MONBAN']);
      expect(new Set(host.around.map((w) => w.id)).size).toBe(host.around.length);
      const alone = storyHome(planet, 'neo', { neo: 'ミナト', inviter: '…', sent: false });
      expect(alone.owner.name).toBe('ミナト');
      expect(alone.around.map((w) => w.author.name)).toEqual(['MIKIE⭐︎DRILL', 'KIMORIN⭐︎']);
      expect(alone.own).toEqual([]);
      const invited = storyHome(planet, 'neo', { neo: 'ミナト', inviter: 'さくら', sent: true, own: { title: 'あさ', text: 'おはよう' } });
      expect(invited.around[0].author).toMatchObject({ name: 'さくら', figure: null });
      expect(invited.own).toHaveLength(1);
      expect(invited.own[0].author.name).toBe('ミナト');
    }
    expect(storyHome('jupiter', 'host', { neo: '' }).around[0].title).toBe('プリプリ・ボカン');
    expect(storyHome('saturn', 'takoyaki', { neo: '' }).around[0].text).toBe('うんち。');
  });

  it('B7: an empty feed on a live route is the member’s own place (never the sample cast); the preview keeps the sample', () => {
    const empty = { planet: 'jupiter', live: true, owner: { id: 'u', name: 'u' }, young: false, lastVisitAt: null, own: [], around: [], far: [] } as never;
    expect(liveHomeShows(empty, true)).toBe('sample');
    expect(liveHomeShows(empty, false)).toBe('empty');
    expect(liveHomeShows(null, false)).toBe('empty');
    expect(liveHomeShows(null, true)).toBe('sample');
  });
});
