import { describe, expect, it } from 'vitest';
import { floorStart, beatHop, floorMotion } from './saturn';
import {
  beatAt,
  CLUB_STYLES,
  clubNotes,
  cuesFor,
  duckOf,
  DUCK_LONG,
  DUCK_VOICE,
  FEST_SCALE,
  festNotes,
  gridOf,
  JUPITER_ART_POP_MS,
  levelsOf,
  musicOf,
  pickClub,
  pickFestBpm,
  SATURN_LAND_MS,
  SOUND_PLANETS,
  thumpLevel,
  workSoundOf,
  type SoundEvent,
} from './sound';

const sfx = (p: Parameters<typeof cuesFor>[0], e: SoundEvent) => cuesFor(p, e).map((c) => (c.at ? `${c.sfx}@${c.at}` : c.sfx));

describe('which event plays what (the prototype’s call sites)', () => {
  it('a tap on the home (M-R337, each scene its own): Saturn pops, Jupiter’s wings then the scroll’s pop, Mercury splashes, Mars a projector, Venus a radio tuning, Uranus the shop’s bell, Pluto a book opening, Neptune bubbles', () => {
    expect(sfx('saturn', 'tap')).toEqual(['pop']);
    expect(sfx('jupiter', 'tap')).toEqual(['flutter', `pop@${JUPITER_ART_POP_MS}`]);
    expect(sfx('mercury', 'tap')).toEqual(['splash']);
    expect(sfx('mars', 'tap')).toEqual(['projector']);
    expect(sfx('venus', 'tap')).toEqual(['tuning']);
    expect(sfx('uranus', 'tap')).toEqual(['bell']);
    expect(sfx('pluto', 'tap')).toEqual(['bookOpen']);
    expect(sfx('neptune', 'tap')).toEqual(['bubble']);
    // no planet falls back to the one chime for everything
    for (const p of SOUND_PLANETS) expect(sfx(p, 'tap')).not.toContain('chime');
  });
  it('▶: you jump out with a pop (Saturn: on landing), the view turns with a whoosh on every planet', () => {
    expect(sfx('saturn', 'playDance')).toEqual([`pop@${SATURN_LAND_MS}`]);
    expect(sfx('mercury', 'playDance')).toEqual(['pop']);
    for (const p of SOUND_PLANETS) expect(sfx(p, 'playTurn')).toEqual(['whoosh']);
  });
  it('▶ visitors: Jupiter and the five ring as each comes; Jupiter pops as the scroll opens, Mercury splashes at the pier, the five their own scene', () => {
    expect(sfx('jupiter', 'playVisit')).toEqual(['chime']);
    expect(sfx('venus', 'playVisit')).toEqual(['chime']);
    expect(sfx('mercury', 'playVisit')).toEqual([]);
    expect(sfx('jupiter', 'playOpen')).toEqual(['pop']);
    expect(sfx('mercury', 'playOpen')).toEqual(['splash']);
    expect(sfx('neptune', 'playOpen')).toEqual(['bubble']);
    expect(sfx('mars', 'playOpen')).toEqual(['projector']);
    expect(sfx('pluto', 'playOpen')).toEqual(['bookOpen']);
    expect(sfx('saturn', 'groovePop')).toEqual(['pop']);
    expect(sfx('jupiter', 'groovePop')).toEqual([]);
  });
  it('the profile whooshes open; its works: Saturn / Jupiter pop, the five their own scene', () => {
    for (const p of SOUND_PLANETS) expect(sfx(p, 'profile')).toEqual(['whoosh']);
    expect(sfx('saturn', 'profileWork')).toEqual(['pop']);
    expect(sfx('jupiter', 'profileWork')).toEqual(['pop']);
    expect(sfx('neptune', 'profileWork')).toEqual(['bubble']);
    expect(sfx('uranus', 'profileWork')).toEqual(['bell']);
    expect(sfx('mercury', 'profileWork')).toEqual([]);
  });
  it('the sky: whooshes for moving about, a splash at the shore, the work’s own sound, a chime for what is kept', () => {
    for (const e of ['skyOpen', 'skyLand', 'skyTrip', 'skyTripBack', 'skyShore'] as const) expect(sfx('mercury', e)).toEqual(['whoosh']);
    expect(sfx('jupiter', 'skyArrive')).toEqual(['splash']);
    expect(sfx('mercury', 'skyShow')).toEqual(['splash']);
    expect(sfx('saturn', 'skyShow')).toEqual(['splash', 'pop']);
    expect(sfx('jupiter', 'skyShow')).toEqual(['splash', 'chime']);
    expect(sfx('neptune', 'skyShow')).toEqual(['splash', 'chip']);
    expect(sfx('saturn', 'skyKeep')).toEqual(['chime']);
    // M-R337: ♡ is two gentle notes, not the chime
    for (const p of SOUND_PLANETS) expect(sfx(p, 'skyOshi')).toEqual(['heart']);
    // 07: the five skies follow the same rules (Neptune's work also bleeps)
    for (const p of ['mars', 'venus', 'uranus', 'pluto', 'neptune'] as const) {
      for (const e of ['skyOpen', 'skyLand', 'skyTrip', 'skyTripBack', 'skyShore'] as const) expect(sfx(p, e)).toEqual(['whoosh']);
      expect(sfx(p, 'skyArrive')).toEqual(['splash']);
      expect(sfx(p, 'skyShow')[0]).toBe('splash');
      expect(sfx(p, 'skyKeep')).toEqual(['chime']);
    }
  });
  it('a planet without the new home has no sounds', () => {
    expect(cuesFor('earth' as never, 'tap')).toEqual([]);
  });
});

describe('▶ music', () => {
  it('Saturn has the club, Jupiter the festival, the others none', () => {
    expect(musicOf('saturn')).toBe('club');
    expect(musicOf('jupiter')).toBe('festival');
    expect(musicOf('mercury')).toBeNull();
    expect(musicOf('neptune')).toBeNull();
  });
  it('the club: kick on each beat, a louder hat between, the bass on the off sixteenths, a pad every 4 bars', () => {
    const st = CLUB_STYLES[0];
    expect(clubNotes(0, st).map((n) => n.kind)).toEqual(['kick', 'hat', 'pad']);
    expect(clubNotes(16, st).map((n) => n.kind)).toEqual(['kick', 'hat']);
    expect(clubNotes(2, st)).toEqual([{ kind: 'hat', v: 0.18 }]);
    expect(clubNotes(1, st)).toEqual([{ kind: 'hat', v: 0.05 }, { kind: 'bass', f: 55 }]);
    expect(clubNotes(16 * 2 + 1, st)[1]).toEqual({ kind: 'bass', f: 65.4 });
    const kicks = Array.from({ length: 64 }, (_, i) => clubNotes(i, st).some((n) => n.kind === 'kick')).filter(Boolean).length;
    expect(kicks).toBe(16);
  });
  it('the festival: taiko on 1 and 3, the shaker between, the melody on the beats (up a step every other 4 bars)', () => {
    expect(festNotes(0).map((n) => n.kind)).toEqual(['taiko', 'pluck', 'pluck']);
    expect(festNotes(0)[0]).toEqual({ kind: 'taiko', v: 0.9 });
    expect(festNotes(4)[0]).toEqual({ kind: 'taiko', v: 0.5 });
    expect(festNotes(3)).toEqual([{ kind: 'shaker', v: 0.12 }]);
    expect(festNotes(2)).toEqual([{ kind: 'pluck', f: FEST_SCALE[2], v: 0.16 }]);
    expect(festNotes(34)).toEqual([{ kind: 'pluck', f: FEST_SCALE[3], v: 0.16 }]);
    expect(festNotes(0)[2]).toEqual({ kind: 'pluck', f: FEST_SCALE[0] / 2, v: 0.12 });
  });
  it('the grids, the random picks and the beat', () => {
    expect(gridOf('club', 120)).toEqual({ spb: 0.5, step: 0.125 });
    expect(gridOf('festival', 120)).toEqual({ spb: 0.5, step: 0.25 });
    expect(pickClub(0).bpm).toBe(124);
    expect(pickClub(0.999).bpm).toBe(120);
    expect(pickFestBpm(0.5)).toBe(96);
    expect(beatAt(-0.1, 120)).toBeNull();
    expect(beatAt(0, 120)).toBe(0);
    expect(beatAt(1.26, 120)).toBe(2);
  });
});

describe('the works are always clearly heard', () => {
  it('the music dips under a voice and goes quiet under a song / MV / radio', () => {
    expect(duckOf([])).toBe(1);
    expect(duckOf(['voice'])).toBe(DUCK_VOICE);
    expect(duckOf(['voice', 'long'])).toBe(DUCK_LONG);
    expect(DUCK_LONG).toBe(0);
  });
  it('a video, a loop or anything over 20 s is a long work; a short clip is a voice', () => {
    expect(workSoundOf({ video: true, loop: false, duration: 3 })).toBe('long');
    expect(workSoundOf({ video: false, loop: true, duration: NaN })).toBe('long');
    expect(workSoundOf({ video: false, loop: false, duration: 95 })).toBe('long');
    expect(workSoundOf({ video: false, loop: false, duration: 2.4 })).toBe('voice');
    expect(workSoundOf({ video: false, loop: false, duration: NaN })).toBe('voice');
  });
  it('the fireworks are softer while a song plays', () => {
    expect(thumpLevel(true)).toBeLessThan(thumpLevel(false));
  });
});

describe('the device’s settings', () => {
  it('the talk’s mute silences everything; the story mixer scales the effects and the music', () => {
    expect(levelsOf('1', null)).toEqual({ sfx: 0, music: 0 });
    expect(levelsOf(null, null)).toEqual({ sfx: 1, music: 1 });
    expect(levelsOf('0', JSON.stringify({ bgm: 0.4, se: 0 }))).toEqual({ sfx: 0, music: 0.5 });
    expect(levelsOf(null, '{broken')).toEqual({ sfx: 1, music: 1 });
  });
});

describe('Saturn: the kororins hop on the beat', () => {
  it('every other one on the floor hops on a beat; one in the air does not', () => {
    const a = { ...floorStart(0, 844), h: 0 };
    const b = { ...floorStart(1, 844), h: 0 };
    expect(beatHop(a, 0, 3, 4)).toBe(true);
    expect(a.vh).toBeGreaterThan(300);
    expect(beatHop(b, 1, 3, 4)).toBe(false);
    expect(b.vh).toBe(0);
    expect(beatHop(b, 1, 3, 5)).toBe(true);
    const up = { ...floorStart(2, 844), h: 40 };
    expect(beatHop(up, 2, 3, 4)).toBe(false);
  });
  it('the floor motion takes the beat', () => {
    expect(typeof floorMotion.beat).toBe('function');
  });
});
