import { z } from 'zod';
import type { BatiEggKind } from './batiPersona';

/**
 * Client 2026-11-27 (story M-R334): changing a look step by step — {bati}'s 「進化」 and the member's own 「変身」.
 * One rule: say how to change it FROM THE LOOK IT HAS NOW (by voice / words, or with a reference picture). Each step
 * paints one picture from the picture before (LOOK_STEP_MODEL), costs one step's mana (MakeKind 'lookStep') and counts
 * down from LOOK_STEP_MAX; after every step the two choices stay (decide / change again) until the last step, where only
 * deciding is left. Day 2 on the Moon uses it (D03-S005b, D03-S004), and an Obolo Order member's later change of their
 * profile uses the same round (LookStepsService.open starts a new one).
 * Everything here is pure: the counter, the choices, what a step may do — the server (apps/api look/steps.service.ts)
 * and the screen (apps/web components/look/LookSteps.tsx) both follow it.
 */

/** the steps of one round (進化 / 変身 あと◯回) */
export const LOOK_STEP_MAX = 8;
/** client 2026-11-27: every evolve / transform step is FLUX.2 klein 4B, an edit of the current picture */
export const LOOK_STEP_MODEL = 'runware:400@4';
/**
 * client 2026-11-27 (confirmed): the one picture a {bati} is born with is Seedream 5.0 Flash — "the food itself as a
 * character", 2D anime (scripts/art-lab/runware_bati_food.py). Every later step is LOOK_STEP_MODEL.
 */
export const BATI_BIRTH_MODEL = 'bytedance:seedream@5.0-flash';
/** the four first pictures of one's own look (日本のアニメのタッチ、頭身ちがい): heads tall */
export const LOOK_PICK4_HEADS = [2, 3, 5, 7] as const;

export const LOOK_STEP_WHOS = ['bati', 'self'] as const;
export type LookStepWho = (typeof LOOK_STEP_WHOS)[number];

/** one round's state: the steps used, decided or not, and the picture it has now (none: the look worn) */
export interface LookStepState {
  used: number;
  fixed: boolean;
  url?: string | null;
}
export const EMPTY_LOOK_STEPS: LookStepState = { used: 0, fixed: false, url: null };

const clampUsed = (used: number, max: number) => Math.max(0, Math.min(max, Math.floor(Number.isFinite(used) ? used : 0)));

/** the steps left (「進化 あと◯回」) */
export function lookStepsLeft(used: number, max: number = LOOK_STEP_MAX): number {
  return max - clampUsed(used, max);
}

/** another step may be made: not decided yet and some are left */
export function canLookStep(s: Pick<LookStepState, 'used' | 'fixed'>, max: number = LOOK_STEP_MAX): boolean {
  return !s.fixed && lookStepsLeft(s.used, max) > 0;
}

/** the round after one step painted `url` (throws when no step is left: the caller refuses before painting) */
export function afterLookStep(s: LookStepState, url: string, max: number = LOOK_STEP_MAX): LookStepState {
  if (!canLookStep(s, max)) throw new Error('LOOK_STEPS_DONE');
  return { used: clampUsed(s.used, max) + 1, fixed: false, url };
}

/**
 * the choices under the picture: before the first step none (the first wish is asked at once); after each step
 * 〔decide〕 and 〔again〕; after the last step only 〔decide〕 (and OBOLON's 「、、、今日の魔法は、ここまでだ。」: `last`)
 */
export function lookStepChoices(s: Pick<LookStepState, 'used' | 'fixed'>, max: number = LOOK_STEP_MAX): { decide: boolean; again: boolean; last: boolean } {
  const used = clampUsed(s.used, max);
  if (s.fixed) return { decide: false, again: false, last: false };
  return { decide: used > 0, again: used > 0 && used < max, last: used >= max };
}

/** the mana a round took so far: its steps only (the four first pictures and the confirmation are their own makings) */
export const lookStepsMana = (used: number, stepMana: number): number => Math.round(clampUsed(used, LOOK_STEP_MAX) * stepMana * 10) / 10;

/** 月のたまご＝♀、太陽のたまご＝♂ (shown only as a small mark beside {bati} once it is born; never drawn into its picture) */
export const eggMark = (egg: BatiEggKind | 'earth' | null | undefined): '♀' | '♂' => (egg === 'sun' ? '♂' : '♀');

/**
 * The favourite food's NAME out of the sentence as it was said (「ゼロ時零分カレーだよ。」 → カレー): the server asks the
 * language model (packages/ai foodNameOf) and falls back on this — the plain rules: the lead-in and the sentence ending
 * are cut, and of what is left the last run of words is taken. Never empty: an answer it cannot cut stays as said.
 */
export function foodNameByRules(said: string): string {
  const raw = said.normalize('NFKC').trim();
  let s = raw.replace(/[。．.!！?？♪〜~…\s]+$/u, '');
  // the lead-in: 「えっと、」「好きな食べ物は」「わたしは」
  s = s.replace(/^(えーっと|えっと|えーと|ええと|あの|うーん|んー|そうだな|そうですね)[、,\s]*/u, '');
  s = s.replace(/^(私|わたし|僕|ぼく|俺|おれ|うち|自分)(の|は|が)?[、,\s]*/u, '');
  s = s.replace(/^(好きな|すきな)?(食べ物|たべもの|食べもの)(は|って|なら)?[、,\s]*/u, '');
  // the ending: 「〜だよ」「〜です」「〜が好き」「〜かな」
  for (let k = 0; k < 3; k++) {
    s = s.replace(/(が|は)?(一番|いちばん|大|だい)?(好き|すき)(です|だ|かな|だよ|だね|なんだ|なの)?$/u, '');
    s = s.replace(/(だよね|だよ|だね|ですね|ですよ|です|でしょう|だと思う|だと思います|かなあ|かなぁ|かな|やで|やな|だな|だ|よ|ね)$/u, '');
    s = s.replace(/[、,。\s]+$/u, '');
  }
  // 「零時零分カレー」 style noise in front: of several parts, the last one
  const parts = s.split(/[、,\s]+/u).filter(Boolean);
  s = parts.length ? parts[parts.length - 1] : s;
  // a clock time heard in front (the phone's own voice-over, 「ゼロ時零分」)
  s = s.replace(/^[0-9０-９零〇ゼロ一二三四五六七八九十]+時([0-9０-９零〇ゼロ一二三四五六七八九十半]+分)?/u, '');
  s = s.trim();
  return (s || raw).slice(0, 40);
}

const Picture = z.object({ mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.string().min(100).max(2_000_000) });

/** one step: whose look, how to change it from the look it has now, and (optional) a reference picture — never stored */
export const LookStepBody = z.object({
  who: z.enum(LOOK_STEP_WHOS),
  wish: z.string().trim().max(120).default(''),
  image: Picture.optional(),
});
export type LookStepBody = z.infer<typeof LookStepBody>;

/** the four first pictures of one's own look: from the photo, or (no photo may be used) from the wished look in words */
export const LookPick4Body = z.object({
  photo: Picture.optional(),
  wish: z.string().trim().max(120).optional(),
  /** the photo's way in (`f_d03_photo`) */
  via: z.enum(['folder', 'camera']).optional(),
});
export type LookPick4Body = z.infer<typeof LookPick4Body>;

/** one of the four becomes the base of the round */
export const LookBaseBody = z.object({ mediaId: z.string().uuid() });
export type LookBaseBody = z.infer<typeof LookBaseBody>;

export const LookWhoBody = z.object({ who: z.enum(LOOK_STEP_WHOS) });
export type LookWhoBody = z.infer<typeof LookWhoBody>;

/** a round as the screen sees it */
export interface LookStepView {
  used: number;
  left: number;
  fixed: boolean;
  /** the picture it has now */
  url: string | null;
}
/** what the screen is told after anything that moved a round */
export interface LookStepResult {
  who: LookStepWho;
  steps: LookStepView;
  /** the mana this call took from the gem (0: nothing) */
  mana: number;
}
export interface LookPick4Result {
  candidates: { id: string; url: string }[];
  mana: number;
}
/** both rounds and what each thing costs now (the live prices) */
export interface LookStepsInfo {
  bati: LookStepView;
  self: LookStepView;
  prices: { step: number; pick4: number; fix: number; birth: number };
}

export const lookStepView = (s: LookStepState, worn: string | null, max: number = LOOK_STEP_MAX): LookStepView => ({
  used: clampUsed(s.used, max),
  left: lookStepsLeft(s.used, max),
  fixed: !!s.fixed,
  url: s.url ?? worn,
});
