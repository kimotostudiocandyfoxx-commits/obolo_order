/**
 * How a story scene is staged (client review of M-R251, 2026-11-23) — the one place to move the boundary:
 *   'cinema'  the story's own staging: one speaker on screen at a time, pushed in close, the camera cutting to each
 *             new speaker; the story's bubbles stacked from the bottom (components/story/Chat.tsx ChatLog)
 *   'row'     the side-by-side talk (components/talk/TalkScene.tsx) in the story's bubble skin: the front row of
 *             three (the one speaking, the one they talk to, you), the rest in the back row
 * Days 1–2 (the scenes before the day-3 morning on the Moon, D04) are cinema; day 3 on, and the members' days, are the
 * row. A single scene can be moved either way in SCENE_STAGE.
 */
export type StoryStage = 'cinema' | 'row';

/** per-scene override (scene id → stage), e.g. { 'D04-S005': 'cinema' } */
export const SCENE_STAGE: Record<string, StoryStage> = {};

/** the scenes whose id starts with one of these are cinema (unless SCENE_STAGE says otherwise) */
export const CINEMA_SCENES = /^D0[1-3]-/;

export function stageOf(sceneId: string | null | undefined): StoryStage {
  if (!sceneId) return 'row';
  return SCENE_STAGE[sceneId] ?? (CINEMA_SCENES.test(sceneId) ? 'cinema' : 'row');
}

/**
 * How the lines are shown, part of the same switch: 'subtitles' (film subtitles at the lower third, no bubbles — the
 * story from day 3 on) or 'bubbles' (the story's own bubbles — days 1–2 for now). Per scene in SCENE_LINES; the
 * review pages try subtitles in the cinema too with ?subs=1 (and bubbles in the row with ?subs=0).
 */
export type StoryLines = 'subtitles' | 'bubbles';
export const SCENE_LINES: Record<string, StoryLines> = {};
export function linesOf(sceneId: string | null | undefined, stage: StoryStage, flag?: string | null): StoryLines {
  if (flag === '1') return 'subtitles';
  if (flag === '0') return 'bubbles';
  return (sceneId && SCENE_LINES[sceneId]) || (stage === 'cinema' ? 'bubbles' : 'subtitles');
}
