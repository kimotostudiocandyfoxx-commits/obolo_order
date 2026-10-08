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
    expect(p.scenes[0].tags).toBe('pink hair, round eyes, rooftop, 1.2, sunset, pastel');
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
