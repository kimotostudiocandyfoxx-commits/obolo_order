import { describe, expect, it, vi } from 'vitest';
import type { HomeWork } from '@obolo/shared';
import { countLine, pinchOf, SAMPLE_CONTINENTS, sampleDrift, sampleSky, sampleSkyWorks, sampleSong, SEARCH_PLACEHOLDER, SKY_COUNT_UNIT, SKY_SLOTS, songOf, TRIP_SLOTS } from './sky';

const seq = () => {
  let i = 0;
  return () => ((i = (i * 9301 + 49297) % 233280), i / 233280);
};

describe('the sky (M-R295〜M-R312) on Mercury, the sample', () => {
  it('じぶんの空: five slots and your island; 旅の空: six', () => {
    expect(SKY_SLOTS).toHaveLength(5);
    expect(TRIP_SLOTS).toHaveLength(6);
  });
  it('a pinch in goes up (or back from a continent); out comes home', () => {
    expect(pinchOf(0.6)).toBe('in');
    expect(pinchOf(1)).toBeNull();
    expect(pinchOf(1.5)).toBe('out');
  });
  it('never chosen: the operator’s first five; ☆ into an empty slot, FULL when five, a slot swaps', async () => {
    const s = sampleSky('mercury', seq());
    const v = await s.sky();
    expect(v.continents).toHaveLength(10);
    expect(v.favourites).toEqual(['edm', 'hiphop', 'ballad', 'rock', 'chill']);
    expect(await s.favourite('jazz', true)).toBe('FULL');
    expect(await s.favourite('rock', false)).toEqual(['edm', 'hiphop', 'ballad', null, 'chill']);
    expect(await s.favourite('jazz', true)).toEqual(['edm', 'hiphop', 'ballad', 'jazz', 'chill']);
    expect(await s.favourite('rain', true, 0)).toEqual(['rain', 'hiphop', 'ballad', 'jazz', 'chill']);
  });
  it('〔✈ 旅〕: six continents, the next press brings the ones not seen yet first', async () => {
    const s = sampleSky('mercury', seq());
    const a = await s.travel();
    expect(a).toHaveLength(6);
    const b = await s.travel();
    const unseen = SAMPLE_CONTINENTS.map((c) => c.key).filter((k) => !a.some((c) => c.key === k));
    expect(b.slice(0, unseen.length).map((c) => c.key).sort()).toEqual(unseen.sort());
  });
  it('a song drifts where its tags score 2 or more; one song to several continents', () => {
    const ws = sampleSkyWorks();
    const edm = sampleDrift(SAMPLE_CONTINENTS[0].rule, ws, seq());
    expect(edm.length).toBeGreaterThan(3);
    expect(edm.every((w) => w.score >= 2)).toBe(true);
    // best first
    expect(edm[0].score).toBeGreaterThanOrEqual(edm[edm.length - 1].score);
    const matsuri = SAMPLE_CONTINENTS.find((c) => c.key === 'matsuri')!;
    const both = sampleDrift(matsuri.rule, ws).map((w) => w.title);
    expect(both).toContain('盆おどりリミックス');
    expect(edm.map((w) => w.title)).toContain('盆おどりリミックス');
  });
  it('search: by name / #tag, with how many songs drifted there', async () => {
    const s = sampleSky('mercury', seq());
    const r = await s.search('雨');
    expect(r[0].key).toBe('rain');
    expect(r[0].count).toBeGreaterThan(0);
    const t = await s.search('', 'アゲ');
    expect(t.map((c) => c.key).sort()).toEqual(['anison', 'edm', 'matsuri']);
  });
  it('landed: the drifted songs; the sample songs play the prototype’s sound and lyrics', async () => {
    const s = sampleSky('mercury', seq());
    const l = await s.land('edm');
    expect(l.continent.pictures.land).toBe('/planets/continents/mercury/edm-land.webp');
    const song = await s.song(l.works[0]);
    expect(song?.url).toMatch(/song-\d\.mp3$/);
  });
});

describe('a work’s song', () => {
  const w = (o: Partial<HomeWork>): HomeWork => ({ id: 'w1', kind: 'planet_post', author: { id: 'a', name: 'a' }, rel: 'dachi', text: '', url: 'https://x/s.m4a', flownAt: '2026-11-25T00:00:00Z', ...o });
  it('the sample’s own lyrics (songs 1 and 3); the API’s for a real song; no lyrics when the API cannot say', async () => {
    expect(sampleSong(w({ url: '/planets/sample/song-1.mp3' }))?.lyrics).toHaveLength(4);
    expect(sampleSong(w({ url: '/planets/sample/song-2.mp3' }))?.lyrics).toEqual([]);
    const api = { planetSong: vi.fn(async () => ({ kind: 'planet_post' as const, id: 'w1', title: 't', url: 'u', art: null, seconds: 60, titleVoice: null, lyrics: [{ t: 1, text: 'a' }] })) };
    expect((await songOf(api, w({})))?.lyrics).toHaveLength(1);
    const broken = { planetSong: vi.fn(async () => Promise.reject(new Error('x'))) };
    expect(await songOf(broken, w({}))).toMatchObject({ url: 'https://x/s.m4a', lyrics: [] });
  });
});

describe('the search shows no tags (M-R310)', () => {
  it("counts the drifted works the planet's way, and asks for a name or genre only", () => {
    expect(countLine('mercury', 8)).toBe('🌊 8曲');
    expect(countLine('jupiter', 3)).toBe('🌊 3作品');
    expect(countLine('saturn', null)).toBe('🌊 0人');
    expect(Object.keys(SKY_COUNT_UNIT)).toHaveLength(8);
    expect(SEARCH_PLACEHOLDER).toBe('大陸の名前・ジャンル');
  });
});

describe('the sample sky on Jupiter and Saturn (06)', () => {
  it('Jupiter: the ten glades, the operator’s first five; arts drift by their style and moods', async () => {
    const s = sampleSky('jupiter', seq());
    const v = await s.sky();
    expect(v.continents).toHaveLength(10);
    expect(v.continents.every((c) => c.creator === null)).toBe(true);
    expect(v.favourites).toEqual(['watercolor', 'anime', 'pixel', 'oil', 'yumekawa']);
    const l = await s.land('cats');
    expect(l.continent.pictures.shore).toBe('/planets/continents/jupiter/cats-shore.webp');
    expect(l.works.map((w) => w.title)).toContain('こたつねこ');
    expect(l.works.every((w) => w.kind === 'jupiter_post' && !!w.url && !!w.author.figure)).toBe(true);
  });
  it('Saturn: the ten plazas; kororins drift by their topic, with the ball and the chibi', async () => {
    const s = sampleSky('saturn', seq());
    const v = await s.sky();
    expect(v.continents.map((c) => c.key)).toEqual(['chat', 'koi', 'oshi', 'school', 'night', 'game', 'warai', 'anime', 'asa', 'nemui']);
    const l = await s.land('koi');
    expect(l.works.length).toBeGreaterThan(2);
    expect(l.works.every((w) => w.kind === 'saturn_post' && !!w.text && !!w.author.ball && !!w.author.figure)).toBe(true);
    expect((await s.search('', '推し'))[0].key).toBe('oshi');
  });
  it('the five have no sample continents yet (06: their sky follows 05’s worlds)', async () => {
    expect((await sampleSky('neptune', seq()).sky()).continents).toEqual([]);
  });
});
