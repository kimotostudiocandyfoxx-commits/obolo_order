import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO, normalizeStory, ruleStory, sceneCount, storyToPlan, type StoryInput } from './storyboard';

const input = (o: Partial<StoryInput> = {}): StoryInput => ({
  title: 'ラーメンの歌',
  seconds: 120,
  bpm: 128,
  mood: '',
  music: 'upbeat j-pop',
  lyrics: [
    { t: 2, text: 'あさ', chorus: false },
    { t: 40, text: 'サビ', chorus: true },
  ],
  hero: 'pink hair, round eyes',
  maxScenes: 30,
  ...o,
});
const total = (s: { dur: number }[]) => s.reduce((a, x) => a + x.dur, 0);

describe('storyboard', () => {
  it('about one scene per two bars, 8 to maxScenes', () => {
    expect(sceneCount(input())).toBe(30);
    expect(sceneCount(input({ seconds: 20 }))).toBe(8);
  });

  it('the rule storyboard fills the song exactly, the hero in most scenes, loud on the chorus', () => {
    const p = ruleStory(input());
    expect(total(p.scenes)).toBeCloseTo(120, 1);
    expect(p.scenes.length).toBeLessThanOrEqual(30);
    expect(p.scenes.filter((s) => s.hero).every((s) => s.tags.includes('pink hair'))).toBe(true);
    expect(p.lyrics).toEqual(['MINIMAL_CHILL', 'ZOOM_BURST']);
  });

  it('normalizes an answer: cleans tags, adds the hero, fits the length, caps the scenes', () => {
    const scenes = Array.from({ length: 40 }, () => ({ dur: 2, hero: true, tags: 'rooftop, (nsfw:1.2), sunset', motion: 'zoom-in' as const, effect: 'NONE' as const }));
    const p = normalizeStory({ note: 'よし', style: 'pastel', scenes, lyrics: ['SHAKE_HARD'] }, input());
    expect(p.scenes.length).toBeLessThanOrEqual(30);
    expect(total(p.scenes)).toBeCloseTo(120, 1);
    expect(p.scenes[0].tags).toBe('solo, pink hair, round eyes, rooftop, 1.2, sunset, pastel');
    expect(p.lyrics).toEqual(['SHAKE_HARD', 'ZOOM_BURST']);
  });

  it('an unusable answer falls back to the rule storyboard', () => {
    expect(normalizeStory({ scenes: [] }, input()).note).toBe(ruleStory(input()).note);
  });

  it('becomes an edit plan with one picture per scene', () => {
    const plan = storyToPlan(ruleStory(input({ hero: DEFAULT_HERO })));
    expect(plan.segments.every((s, k) => s.m === k && !s.key)).toBe(true);
  });
});

describe('story cuts on the bars', () => {
  it('splits a long scene into bar-length shots of the same picture, faster in the chorus', () => {
    const story = { note: '', style: '', lyrics: [], scenes: [
      { dur: 8, tags: 'a', hero: true, motion: 'zoom-in' as const, effect: 'NONE' as const },
      { dur: 4, tags: 'b', hero: true, motion: 'pan-left' as const, effect: 'SPEED_LINES' as const },
    ] };
    // 120 BPM: a bar is 2 s; verse until 8 s, chorus after
    const plan = storyToPlan(story, 120, [{ t: 0, text: 'v', chorus: false }, { t: 8, text: 'c', chorus: true }]);
    expect(plan.segments.map((s) => [s.m, s.dur])).toEqual([[0, 4], [0, 4], [1, 2], [1, 2]]);
    expect(plan.segments[0].motion).not.toBe(plan.segments[1].motion);
    expect(plan.segments[2].effect).toBe('SPEED_LINES');
    expect(plan.segments[3].effect).toBe('NONE');
    expect(storyToPlan(story).segments).toHaveLength(2);
  });

  it('hero-less scenes never draw people; GLITCH only on loud songs', () => {
    const i = { title: 't', seconds: 12, bpm: 120, mood: '', music: 'soft piano ballad', lyrics: [], hero: 'fox', maxScenes: 10 };
    const p = normalizeStory({ style: 'x', scenes: [
      { dur: 4, tags: '1girl, park', hero: false, motion: 'zoom-in', effect: 'GLITCH' },
      { dur: 4, tags: 'running', hero: true, motion: 'zoom-in', effect: 'NONE' },
      { dur: 4, tags: 'sky', hero: true, motion: 'zoom-in', effect: 'NONE' },
    ] }, i);
    expect(p.scenes[0].tags.startsWith('no humans, scenery')).toBe(true);
    expect(p.scenes[0].tags).not.toContain('1girl');
    expect(p.scenes[0].effect).toBe('SPEED_LINES');
    expect(p.scenes[1].tags.startsWith('solo, fox')).toBe(true);
    expect(normalizeStory({ scenes: [{ dur: 4, tags: 'a', hero: true, motion: 'zoom-in', effect: 'GLITCH' }, { dur: 4, tags: 'b', hero: true, motion: 'zoom-in', effect: 'NONE' }, { dur: 4, tags: 'c', hero: true, motion: 'zoom-in', effect: 'NONE' }] }, { ...i, music: 'hard rock' }).scenes[0].effect).toBe('GLITCH');
  });
});
