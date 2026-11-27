/**
 * How a story scene is staged (client review of M-R251, 2026-11-23) — the one place to move the boundary:
 *   'cinema'  the story's own staging: one speaker on screen at a time, pushed in close, the camera cutting to each
 *             new speaker; the story's bubbles stacked from the bottom (components/story/Chat.tsx ChatLog)
 *   'row'     the side-by-side talk (components/talk/TalkScene.tsx) in the story's bubble skin: the front row of
 *             three (the one speaking, the one they talk to, you), the rest in the back row
 *   'film'    day 1 as it was before the cinema (client 2026-11-27: 「トークの見せ方を前の形に戻す」): the motion keeps
 *             playing with the characters in it, the camera pushes in on the picture itself (the script's 〔カメラ〕
 *             steps), and the lines are the story's first chat bubbles over it (a small round face, the name, the
 *             bubble; ChatLog without closeUp). No cut-out comes forward
 * Day 1 (D01) is film; day 2 (D02–D03, until the day-3 morning on the Moon, D04) is cinema; day 3 on, and the members'
 * days, are the row. A single scene can be moved either way in SCENE_STAGE.
 */
export type StoryStage = 'film' | 'cinema' | 'row';

/** per-scene override (scene id → stage), e.g. { 'D04-S005': 'cinema' } */
export const SCENE_STAGE: Record<string, StoryStage> = {};

/** the scenes whose id starts with one of these are film / cinema (unless SCENE_STAGE says otherwise) */
export const FILM_SCENES = /^D01-/;
export const CINEMA_SCENES = /^D0[23]-/;

export function stageOf(sceneId: string | null | undefined): StoryStage {
  if (!sceneId) return 'row';
  return SCENE_STAGE[sceneId] ?? (FILM_SCENES.test(sceneId) ? 'film' : CINEMA_SCENES.test(sceneId) ? 'cinema' : 'row');
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
  return (sceneId && SCENE_LINES[sceneId]) || (stage === 'row' ? 'subtitles' : 'bubbles');
}
