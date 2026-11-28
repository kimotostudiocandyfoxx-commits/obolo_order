import { describe, expect, it } from 'vitest';
import { liveHomeShows } from '../planetTemplate/sample';
import { storyHome } from '../planetTemplate/storyCast';
import { DAY3, DAY3_BEFORE, DAY3_NEW_HOME } from './day3';
import { DAY4, DAY4_BEFORE, DAY4_NEW_HOME } from './day4';
import { DAY5, DAY5_BEFORE, DAY5_NEW_HOME } from './day5';
import { DAY6, DAY6_BEFORE, DAY6_NEW_HOME } from './day6';
import { DAY7, DAY7_BEFORE, DAY7_NEW_HOME } from './day7';
import { D3_GROOVE_BEFORE, D3_GROOVE_NOTE, D3_GROOVE_NOW, D3_PLAY_ALL_NOTE, D3_SUSHIMON, OSHI_NOTES, oshiNote } from './newHomeScenes';
import { HOME_CAST, oshiOn } from '../planetTemplate/roster';
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
    // M-R340: the note about 〔▶ 全部流す〕 and the needle's mic is only for the home that has them (the one of before)
    const notes3 = (d: Step[]) => d.flatMap((s) => (s.t === 'notice' ? [s.text] : []));
    expect(notes3(DAY3_BEFORE)).toContain(D3_PLAY_ALL_NOTE);
    expect(notes3(DAY3_NEW_HOME)).not.toContain(D3_PLAY_ALL_NOTE);
    expect(notes3(DAY3_NEW_HOME).some((t) => t.includes('全部流す') || t.includes('針のマイク'))).toBe(false);
    expect(notes3(DAY3_NEW_HOME)).toContain(D3_GROOVE_NOTE);
    expect(DAY3_NEW_HOME).toHaveLength(DAY3_BEFORE.length);
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

  it('the cast (M-R341 / M-R342): the resident’s place has KIMORIN⭐︎ (pushed) and the story’s cast met so far; {neo}’s has the inviter (when someone invited), KIMORIN⭐︎ and that day’s oshi — nobody else', () => {
    const DAY = { saturn: 3, jupiter: 4, mercury: 5, mars: 6, venus: 7, pluto: 8, neptune: 9, uranus: 10 } as const;
    const COUNT = { saturn: 9, jupiter: 10, mercury: 11, mars: 12, venus: 15, pluto: 16, neptune: 17, uranus: 18 } as const;
    const HOSTS = { saturn: ['たこ焼きブラザー', 'たこ焼きシスター'], jupiter: ['大根カイザー'], mercury: ['フリージー'], mars: ['ヒポキン'], venus: ['ボスG', 'ロングG', 'ハットG'], pluto: ['クロコパトラ'], neptune: ['オニモンク'], uranus: ['MONBAN'] } as const;
    for (const planet of ['saturn', 'jupiter', 'mercury', 'mars', 'venus', 'pluto', 'neptune', 'uranus'] as const) {
      const host = storyHome(planet, planet === 'saturn' ? 'takoyaki' : 'host', { neo: 'ミナト' });
      expect(host.own).toEqual([]);
      const there = host.around.map((w) => w.author.name);
      expect(there[0]).toBe('KIMORIN⭐︎');
      // the script's own: MONBAN's kororin on the takoyaki siblings' record (D04-S005); on no other host's place
      expect(there.includes('MONBAN')).toBe(planet === 'saturn');
      for (const h of HOSTS[planet]) expect(there).not.toContain(h);
      for (const n of there) expect(HOME_CAST.has(n), n).toBe(true);
      expect(new Set(host.around.map((w) => w.id)).size).toBe(host.around.length);
      const alone = storyHome(planet, 'neo', { neo: 'ミナト', inviter: '…', sent: false });
      expect(alone.owner.name).toBe('ミナト');
      const came = alone.around.map((w) => w.author.name);
      // M-R343: nobody invited → nobody in the inviter's spot (no MIKIE⭐︎DRILL stand-in before Order)
      expect(came[0]).toBe('KIMORIN⭐︎');
      expect(came).not.toContain('MIKIE⭐︎DRILL');
      expect(storyHome(planet, 'neo', { neo: 'ミナト', inviter: 'MIKIE⭐︎DRILL' }).around.map((w) => w.author.name)).toEqual(came);
      // the oshi of the day this planet is visited on (the handoff's table), each once, each on this planet's figure
      expect(came.slice(1)).toEqual(oshiOn(DAY[planet]).map((p) => p.name));
      expect(came.slice(1)).toHaveLength(COUNT[planet]);
      for (const w of alone.around.slice(1)) {
        expect(w.rel).toBe('oshi');
        expect(w.author.figure ?? w.author.ball).toMatch(/^\/planets\/sample\/(fig|chibi)-/);
      }
      for (const n of [...there, ...came]) expect(['ユウキ', 'nana', 'れい', 'ショウ', 'ミオ']).not.toContain(n);
      expect(alone.own).toEqual([]);
      const invited = storyHome(planet, 'neo', { neo: 'ミナト', inviter: 'さくら', sent: true, own: { title: 'あさ', text: 'おはよう' } });
      // story 2026-11-28: the inviter comes only with their REAL work of this planet (lib/planetTemplate/inviterWork.ts); none given: not there
      expect(invited.around.map((w) => w.author.name)).not.toContain('さくら');
      expect(invited.around[0].author.name).toBe('KIMORIN⭐︎');
      expect(invited.own).toHaveLength(1);
      expect(invited.own[0].author.name).toBe('ミナト');
    }
    expect(storyHome('jupiter', 'host', { neo: '' }).around[0].title).toBe('プリプリ・ボカン');
    expect(storyHome('saturn', 'takoyaki', { neo: '' }).around[0].text).toBe('うんち。');
  });

  it('M-R341 / M-R343: each resident becomes {neo}’s oshi at the end of the scene they first appear in — on both versions of the day', () => {
    const notes = (d: Step[]) => d.flatMap((s) => (s.t === 'notice' ? [s.text] : []));
    const days: [3 | 4 | 5 | 6 | 7, Step[], Step[]][] = [[3, DAY3_BEFORE, DAY3_NEW_HOME], [4, DAY4_BEFORE, DAY4_NEW_HOME], [5, DAY5_BEFORE, DAY5_NEW_HOME], [6, DAY6_BEFORE, DAY6_NEW_HOME], [7, DAY7_BEFORE, DAY7_NEW_HOME]];
    for (const [day, before, now] of days) {
      const note = oshiNote(OSHI_NOTES[day].who);
      expect(note).toContain('が、{neo}の推しになった｜推しは、どの星でも、{neo}の島に遊びに来ます');
      expect(note).not.toContain('M-R341');
      for (const d of [before, now]) {
        expect(notes(d).filter((t) => t === note)).toHaveLength(1);
        // the last thing of its scene: the next step starts another scene
        const at = d.findIndex((s) => s.t === 'notice' && s.text === note);
        expect(d[at + 1].t).toBe('scene');
        expect(d.slice(0, at).reverse().find((s) => s.t === 'scene')).toMatchObject({ id: OSHI_NOTES[day].scene });
      }
    }
  });

  it('M-R336 / M-R343: the seven Sushimon board the rocket on day 3 — on both versions, after 〔ロケットに乗る〕 and before the rocket leaves', () => {
    const who = D3_SUSHIMON.flatMap((s) => (s.t === 'say' ? [s.who] : []));
    expect(who).toEqual(['？？？', 'KIMORIN', 'サーぽん', 'しゃりお', 'ガリみ♡', 'えびすけ', 'ウニまる', 'いかチョロ', 'かにぶぅ', 'KIMORIN', 'バティ']);
    for (const d of [DAY3_BEFORE, DAY3_NEW_HOME]) {
      const board = d.findIndex((s) => s.t === 'action' && s.label === 'ロケットに乗る');
      expect(d.slice(board + 1, board + 1 + D3_SUSHIMON.length)).toEqual(D3_SUSHIMON);
      expect(d[board + 1 + D3_SUSHIMON.length]).toEqual({ t: 'sprite', image: null });
    }
    expect(D3_SUSHIMON[D3_SUSHIMON.length - 1]).toEqual({ t: 'notice', text: oshiNote('スシモンの7体') });
  });

  it('M-R343: nobody invited → no stand-in: the inviter’s parts of day 3 are skipped, and nobody is in that spot on {neo}’s place', () => {
    for (const d of [DAY3_BEFORE, DAY3_NEW_HOME]) {
      const skips = d.flatMap((s) => (s.t === 'branch' && s.key === 'f_inviter' ? [s.cases.none] : []));
      expect(skips).toEqual(['inv-a-end', 'inv-b-end', 'reply-end']);
      for (const l of skips) expect(labels(d)).toContain(l);
      // what is skipped: the inviter's kororin and its two lines, the name card, the thread with the first message
      const cut = (from: string, to: string) => d.slice(d.findIndex((s) => s.t === 'label' && s.id === from), d.findIndex((s) => s.t === 'label' && s.id === to));
      expect(says(cut('inv-a', 'inv-a-end'))).toEqual(['今のは、招待者の、{inviter}のだZE。', '{neo}を、ここに招いてくれた人だワ。']);
      expect(cut('inv-b', 'inv-b-end').some((s) => s.t === 'caption' && s.text === '{inviter}がダチになった')).toBe(true);
      expect(cut('inv-c', 'reply-end').some((s) => s.t === 'dachivoice')).toBe(true);
      // no voice recorded: the inviter's own words as a text message (never MIKIE⭐︎DRILL's)
      const dv = d.find((s) => s.t === 'dachivoice');
      expect(dv?.t === 'dachivoice' && dv.fallback).toEqual({ t: 'say', who: '{inviter}', text: 'ようこそ。……あなたのつぶやき、聞こえたよ。' });
    }
    expect(says([...DAY3_BEFORE, ...DAY3_NEW_HOME]).some((t) => t.includes('聞こえたわよ'))).toBe(false);
  });

  it('M-R341: the order of the days is not the switch — Venus ends with 「明日は、冥王星だ。」 on both versions', () => {
    for (const d of [DAY7_BEFORE, DAY7_NEW_HOME]) {
      expect(says(d)).toContain('明日は、冥王星だ。いちばん遠くて、暗い星だ。');
      expect(says(d)).toContain('……まだ、星めぐりは続くのですね。');
      expect(says(d)).not.toContain('明日は、地球だ。その先に、太陽がある。');
    }
  });

  it('B7: an empty feed on a live route is the member’s own place (never the sample cast); the preview keeps the sample', () => {
    const empty = { planet: 'jupiter', live: true, owner: { id: 'u', name: 'u' }, young: false, lastVisitAt: null, own: [], around: [], far: [] } as never;
    expect(liveHomeShows(empty, true)).toBe('sample');
    expect(liveHomeShows(empty, false)).toBe('empty');
    expect(liveHomeShows(null, false)).toBe('empty');
    expect(liveHomeShows(null, true)).toBe('sample');
  });
});
