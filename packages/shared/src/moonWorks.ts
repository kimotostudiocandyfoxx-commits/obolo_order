import { z } from 'zod';
import { MARKED_KINDS, type BluenaPlanet } from './finds';
import { seesOnlyDachi } from './schemas';
import { batiRuleTransform, isBatiRare, normalizeBatiPersonality, resolveBatiSpeech, type BatiEggKind, type BatiPersonality } from './batiPersona';
import { BATI_VARIANTS, type BatiVariantSet } from './batiVariants';

/**
 * M-R253 「月はいちばん大事な所」 (docs/story-rewrite/月の工房_作る・直す・残す.md): five things on top of the Moon atelier
 * (one {bati} chat, M-R210 / M-R211).
 *  1. A redo is stacked inside the same work (versions); the one looked at last is the work's face. Bluena keeps one
 *     work with every try inside it.
 *  2. Point, then ask: the part to change (a spot on a picture, a stretch of a song, a scene, some words) goes with
 *     the words of the request.
 *  3. A work made before can be the material of the next one (Bati proposes it on the morning a kind opens).
 *  4. Slow work says when to come back (「4分後に戻ってきてね」), counts down on the card and tells when it is done.
 *  5. When a flown work comes home after 88 h, {bati} tells the reactions (under 15: only the dachi's).
 */

// --- 1. versions ------------------------------------------------------------------------------------------------

/** what the Moon atelier makes (the web's AtelierKind) */
export const MOON_WORK_KINDS = ['look', 'bati', 'lookup', 'image', 'voice', 'art', 'song', 'video', 'radio', 'novel', 'game', 'goods'] as const;
export type MoonWorkKind = (typeof MOON_WORK_KINDS)[number];
/** tries kept in one work (the oldest goes first when there are more) */
export const MAX_VERSIONS = 12;

const Url = z.string().max(2000).nullish();

/** 2. the part pointed at on the card */
export const RefineTarget = z.discriminatedUnion('kind', [
  /** a picture: the spot (0..1 of the width / height), the small ring's radius */
  z.object({ kind: z.literal('point'), x: z.number().min(0).max(1), y: z.number().min(0).max(1), r: z.number().min(0).max(0.5).optional() }),
  /** a song: a stretch of the waveform, in seconds */
  z.object({ kind: z.literal('range'), from: z.number().min(0).max(3600), to: z.number().min(0).max(3600) }),
  /** a film: one scene of `of`, and where it is (seconds) */
  z.object({ kind: z.literal('frame'), index: z.number().int().min(0).max(99), of: z.number().int().min(1).max(100), at: z.number().min(0).max(3600).optional() }),
  /** words (a kororin, a show's heard words, a lookup): the characters chosen */
  z.object({ kind: z.literal('span'), start: z.number().int().min(0).max(5000), end: z.number().int().min(0).max(5000), text: z.string().max(200) }),
]);
export type RefineTarget = z.infer<typeof RefineTarget>;

/** where a try is kept (the planets' own store; `local` = the device) */
export const WorkRef = z.object({ kind: z.enum(MARKED_KINDS), id: z.string().min(1).max(120) });
export type WorkRef = z.infer<typeof WorkRef>;

export const WorkVersion = z.object({
  ref: WorkRef.nullable().default(null),
  prompt: z.string().max(600).default(''),
  title: z.string().max(120).nullish(),
  text: z.string().max(2000).nullish(),
  image: Url,
  audio: Url,
  video: Url,
  poster: Url,
  /** the part this try changed (2.) */
  target: RefineTarget.optional(),
  at: z.string().max(40),
});
export type WorkVersion = z.infer<typeof WorkVersion>;

/** 5. where the work was made: the talk and the moment (opened again from Bluena) */
export const WorkOrigin = z.object({
  thread: z.string().min(1).max(60),
  talkId: z.string().max(60).optional(),
  msgId: z.string().max(60).optional(),
  /** the day of the talk (YYYY-MM-DD), as the left drawer counts it */
  day: z.string().max(10).optional(),
  at: z.string().max(40),
});
export type WorkOrigin = z.infer<typeof WorkOrigin>;

/** 3. a work used as material (shown small on the new card; a tap opens it) */
export const WorkMaterial = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(MOON_WORK_KINDS),
  title: z.string().max(120).default(''),
  image: Url,
  /** a song's sound (a show is recorded over it) */
  audio: Url,
  /** a kororin's words (the lyrics of a song made from it) */
  text: z.string().max(400).nullish(),
  ref: WorkRef.nullable().optional(),
});
export type WorkMaterial = z.infer<typeof WorkMaterial>;

export const CreateMoonWorkBody = z.object({
  kind: z.enum(MOON_WORK_KINDS),
  version: WorkVersion,
  origin: WorkOrigin.optional(),
  materials: z.array(WorkMaterial).max(6).default([]),
});
export type CreateMoonWorkBody = z.infer<typeof CreateMoonWorkBody>;
export const AddVersionBody = z.object({ version: WorkVersion });
export type AddVersionBody = z.infer<typeof AddVersionBody>;
export const SetFaceBody = z.object({ index: z.number().int().min(0).max(MAX_VERSIONS - 1) });
export type SetFaceBody = z.infer<typeof SetFaceBody>;

export interface MoonWorkView {
  id: string;
  kind: MoonWorkKind;
  versions: WorkVersion[];
  /** the face (the try looked at last) */
  active: number;
  origin: WorkOrigin | null;
  materials: WorkMaterial[];
  createdAt: string;
  updatedAt: string;
}

const clampIndex = (i: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(i)));

/** a new try goes on top and becomes the face; past MAX_VERSIONS the oldest goes */
export function addVersion(versions: readonly WorkVersion[], v: WorkVersion): { versions: WorkVersion[]; active: number; dropped: WorkVersion[] } {
  const all = [...versions, v];
  const dropped = all.length > MAX_VERSIONS ? all.splice(0, all.length - MAX_VERSIONS) : [];
  return { versions: all, active: all.length - 1, dropped };
}

/** the try looked at last is the face */
export function setFace(versions: readonly WorkVersion[], i: number): number {
  return versions.length ? clampIndex(i, versions.length) : 0;
}

/** a try thrown away inside the work (the last one cannot be: throw the work away instead) */
export function dropVersion(versions: readonly WorkVersion[], active: number, i: number): { versions: WorkVersion[]; active: number; dropped: WorkVersion } | null {
  if (versions.length <= 1 || i < 0 || i >= versions.length) return null;
  const out = versions.filter((_, k) => k !== i);
  const next = i < active ? active - 1 : i === active ? Math.min(active, out.length - 1) : active;
  return { versions: out, active: clampIndex(next, out.length), dropped: versions[i] };
}

export const refKey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;

/** Bluena shows one work: the stores' items of its other tries are not listed on their own */
export function hiddenRefs(works: readonly Pick<MoonWorkView, 'versions' | 'active'>[]): Set<string> {
  const hide = new Set<string>();
  for (const w of works) {
    const face = w.versions[w.active]?.ref;
    for (const v of w.versions) if (v.ref && (!face || refKey(v.ref) !== refKey(face))) hide.add(refKey(v.ref));
  }
  return hide;
}

// --- 2. pointing ------------------------------------------------------------------------------------------------

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** the part pointed at, in words for the painter / the composer (「左上のあたり」「0:40〜1:05のところ」) */
export function targetWords(t: RefineTarget): string {
  switch (t.kind) {
    case 'point': {
      const v = t.y < 1 / 3 ? '上' : t.y > 2 / 3 ? '下' : '';
      const h = t.x < 1 / 3 ? '左' : t.x > 2 / 3 ? '右' : '';
      const where = h + v || 'まん中';
      return `${where === '上' || where === '下' ? `まん中の${where}` : where}のあたり`;
    }
    case 'range': {
      const [a, b] = t.from <= t.to ? [t.from, t.to] : [t.to, t.from];
      return `${clock(a)}〜${clock(b)}のところ`;
    }
    case 'frame':
      return `${t.index + 1}つ目の場面`;
    case 'span':
      return `「${t.text.slice(0, 40)}」のところ`;
  }
}

/** the request with the part in front: 「左上のあたりを、もっと青く」 */
export function withTarget(prompt: string, t?: RefineTarget | null): string {
  return t ? `${targetWords(t)}を、${prompt}` : prompt;
}

// --- 4. how long it takes -----------------------------------------------------------------------------------------

/** what is timed: the generations people wait for (demo = the review page's stand-in jobs) */
export const ETA_KINDS = ['song', 'mv', 'mvEdit', 'radio', 'art', 'voice', 'look', 'demo', 'game'] as const;
export type EtaKind = (typeof ETA_KINDS)[number];
/** the table the estimate starts from (ms); recent real times pull it toward what it takes now */
// R17: a song is sung on Runware (~15–30 s) — a minute with the lyrics and the design; the recent real times pull it in
export const ETA_BASE_MS: Record<EtaKind, number> = { song: 60_000, mv: 210_000, mvEdit: 90_000, radio: 20_000, art: 18_000, voice: 6_000, look: 15_000, demo: 20_000, game: 60_000 };
/** at or under this, {bati} says no time: you wait in place */
export const QUICK_MS = 30_000;
/** when it will be late, {bati} says so first and gives this much more */
export const LATE_EXTEND_MS = 60_000;
/** said as late this long before the time is up (0: when the time is up and it is not done) */
export const LATE_LEAD_MS = 0;
/** tries in all: after two failures in a row the automatic re-try stops ({bati}: 「少ししてから、もう一回、頼んでくれる？」) */
export const JOB_MAX_ATTEMPTS = 2;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The time a job will take: the table, pulled toward the median of the recent real times (≥ 3 of them, the last 20),
 * then longer with the work waiting before it (half again for each, up to four). Rounded up to 10 s.
 */
export function estimateEtaMs(kind: EtaKind, recentMs: readonly number[] = [], waiting = 0): number {
  const base = ETA_BASE_MS[kind];
  const recent = recentMs.filter((x) => Number.isFinite(x) && x > 0).slice(-20);
  let est = recent.length >= 3 ? 0.6 * median(recent) + 0.4 * base : base;
  est *= 1 + 0.5 * Math.max(0, Math.min(4, Math.floor(waiting)));
  return Math.max(5_000, Math.ceil(est / 10_000) * 10_000);
}

export const isQuick = (etaMs: number) => etaMs <= QUICK_MS;

/** whole minutes to say (「4分後に戻ってきてね」): at least 1 */
export const etaMinutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

/** the card's count: 「あと3分」「あと20秒」「もうすぐ」 */
export function leftWords(ms: number): string {
  if (ms > 60_000) return `あと${Math.ceil(ms / 60_000)}分`;
  if (ms > 10_000) return `あと${Math.ceil(ms / 10_000) * 10}秒`;
  return 'もうすぐ';
}

/** how far along it is (0..1) between its start and its time */
export function progressOf(startedAt: number, etaAt: number, now: number): number {
  if (etaAt <= startedAt) return 1;
  return Math.max(0, Math.min(0.97, (now - startedAt) / (etaAt - startedAt)));
}

/** still working near its time: late (said first), with more time given */
export function lateEta(etaAt: number, now: number): { etaAt: number; late: boolean } {
  return now >= etaAt - LATE_LEAD_MS ? { etaAt: now + LATE_EXTEND_MS, late: true } : { etaAt, late: false };
}

/** errors a new try will not mend (the words, the mana, the room …) */
const NO_RETRY = ['MODERATION', 'NO_MANA', 'STORAGE_FULL', 'NOT_FOUND', 'DEMO', 'FORBIDDEN', 'BAD_REQUEST', 'VALIDATION', 'STICKER_TRIES', 'LOOK_REFINES', 'RESTYLE_TRIES'];
export function shouldRetry(code: string | null | undefined, attempts: number): boolean {
  return attempts < JOB_MAX_ATTEMPTS && !NO_RETRY.includes(code ?? '');
}

// --- 5. back home -------------------------------------------------------------------------------------------------

/** who put a ★ on a flown work */
export interface HomeReaction {
  name: string;
  /** a mutual follow of the maker */
  dachi: boolean;
  stars: number;
}

export interface HomecomingView {
  /** the flown post (`${kind}:${id}`) */
  key: string;
  planet: BluenaPlanet;
  title: string;
  image?: string | null;
  homeAt: string;
  /** the dachi who put a ★ (by name) */
  named: { name: string; stars: number }[];
  /** others who put a ★ (a count only; 0 for a viewer under 15) */
  strangers: number;
  /** the atelier work it is (to open its card) */
  workId?: string | null;
}

/** M-R213 / M-R253 §5: under 15 (or no birth year) only the dachi's reactions are told; others only as a count */
export function reactionsFor(viewerBirthYear: number | null | undefined, rs: readonly HomeReaction[], now = new Date()): { named: { name: string; stars: number }[]; strangers: number } {
  const named = rs.filter((r) => r.dachi).map((r) => ({ name: r.name, stars: r.stars }));
  if (seesOnlyDachi(viewerBirthYear, now)) return { named, strangers: 0 };
  return { named, strangers: rs.filter((r) => !r.dachi).length };
}

/**
 * M-R253 §6: {bati}'s official lines (as written = 元気な子; the other styles in BATI_VARIANTS, rendered by batiLine /
 * batiSay before the placeholders are filled). Where a scene has several, they are used in turn, never the same twice in
 * a row. {n} = minutes, {work} = the work's name, {planet} = a planet, {friend} = a dachi, {k} = how many more, {place} =
 * the planet's own place, {neo} = the member, {bati} = {bati}'s name.
 */
export const MOON_LINES = {
  /** ① the morning a kind opens: a work made before as material (buttons 〔使う〕〔今日は新しく〕) */
  propose: {
    art: '3日目のコロリン、絵にしてみる？　あの言葉、絵にしたら、どうなるか、見てみたい。',
    song: '3日目のコロリン、歌詞にしてみる？　{work}、けっこう、いいこと言ってたよ。',
    video: '4日目の絵と、昨日の曲で、映像にしよう。……絶対、合うと思う。',
    radio: '今まで作った曲を流して、しゃべってみる？　DJ、{neo}。',
  },
  fresh: '了解！　まっさらから、いこう。',
  /**
   * ② slow work: when to come back — R11 (client): to this talk, never tempted elsewhere (no planet, no Bluena, no ダチ
   * talk while it is made)
   */
  backSong: 'この曲は、だいたい{n}分かかるよ。できたころに、このトークに戻ってきてね。',
  back: ['よし、作り始めた！　だいたい{n}分。できたころに、このトークに戻ってきてね。', '{n}分くらい、かかりそう。できたら、このトークで見せるね。'],
  backBig: 'これは、ちょっと大物。だいたい{n}分。できたころに、このトークに戻ってきてね。',
  /**
   * R11 (client): before anything that spends mana — a vague ask gets one question (a few ideas inside the sentence, no
   * chips), a clear one a spell; only a yes in words starts it ({short} = the mana missing)
   */
  ask: {
    song: 'いいね！　どんな曲にする？　「明るいポップ」とか「しっとりバラード」とか、気分やテーマを教えて。',
    art: 'いいね！　どんな絵にする？　「夜の海とクジラ」とか「星空の街」とか、描きたいものを教えて。',
    video: 'いいね！　どんな映像にする？　「夜空をとぶ」とか「海辺をさんぽ」とか、雰囲気を教えて。',
    look: 'いいね！　どんなふうに変える？　「もっとかっこよく」とか「ふんわりかわいく」とか、言ってみて。',
    bati: 'いいね！　どんなかっこうにする？　「魔法使い」とか「宇宙飛行士」とか、言ってみて。',
  },
  /**
   * the spell (スペル): the line as its talismans appear in the sky over the bowl (the mana floats under them), and the
   * question after it — no buttons: a yes in words casts it, any other words change it ({tag} = a talisman tapped)
   */
  plan: 'じゃあ、こういうスペルになるね。',
  replan: 'スペルを、こう変えたよ。',
  confirm: 'このスペルで作る？　それとも、どこか変える？',
  tapHint: '外したいなら、「{tag}は外して」って言ってね。',
  start: 'よし、作るね！',
  noMana: 'ごめん、マナが{short}たりないみたい。',
  /** ③ late; the second time its own line */
  late: ['ごめん、あと1分だけ！　いま、いちばん、いい所。', 'ごめん、ちょっと混んでる。あと{n}分、ちょうだい。'],
  late2: '……ほんとに、ごめん。あと{n}分。その分、いいの作る。',
  /** ④ it failed and is made again; a quick one (no time); the second failure in a row (the re-try stops) */
  retry: ['あっ、ごめん！　うまく、できなかった。もう一回、作るね。だいたい{n}分。', 'ごめん、失敗しちゃった。……今度は、ちゃんとやる。{n}分ちょうだい。'],
  retryQuick: 'ごめん、やり直す！　ちょっと待ってて。',
  stop: 'ごめん、今日はちょっと調子が悪いみたい。少ししてから、もう一回、頼んでくれる？',
  /** ⑤ done: the toast in the app, the push outside it, and the word when you come back to the card */
  toast: ['できたよ！', '{work}、できた！'],
  push: '{bati}：{work}、できたよ！　見に来て。',
  welcome: ['おかえり！　見て見て。', '待たせたね。どう？'],
  /** ⑥ back home after 88 hours (no ★: no numbers) */
  homeOne: '「{work}」が、{planet}から帰ってきたよ。{friend}が★つけてたよ。',
  homeMany: '「{work}」が、{planet}から帰ってきたよ。{friend}と、ほか{k}人が★つけてた。',
  homeNone: '「{work}」が、{planet}から帰ってきたよ。のんびり、浮かんでたって。',
  homePlace: '{place}に、しまっておいたよ。',
  /** ⑦ a work dragged in from Bluena: as a rule; only one kind can be made today; two or more works; a kind not open yet */
  dragIn: 'おっ、{work}！　これを材料にするんだね。何にする？',
  dragOnly: '{work}で、{kind}を作ろう。どんな感じにする？',
  dragMix: '{work}と{work2}、まぜちゃおう。……ワクワクしてきた。',
  dragLocked: 'それは、{d}日後に作れるようになるよ。それまで、とっておこう。',
} as const;

/** every fixed {bati} line above (each has its variants in BATI_VARIANTS) */
export const MOON_LINE_TEXTS: string[] = Object.values(MOON_LINES).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? [...v] : Object.values(v)));

/**
 * A {bati} line in its manner where there is no app (the server's push): the written variant, a rare style's rewrite or
 * the rule; then the 一人称 and 呼び方 (the web's batiLine does the same).
 */
export function batiSay(text: string, b?: { personality?: BatiPersonality; egg?: BatiEggKind; self?: string | null; selfCustom?: string | null; callCustom?: string | null; lines?: Record<string, string> } | null): string {
  if (!b?.personality) return text;
  const p = normalizeBatiPersonality(b.personality);
  const said = p === 'genki' ? text : isBatiRare(p) ? (b.lines?.[text] ?? text) : (BATI_VARIANTS[text]?.[p as keyof BatiVariantSet] ?? batiRuleTransform(text, p));
  return resolveBatiSpeech(said, { personality: p, egg: b.egg, self: b.selfCustom, bornSelf: b.self, call: b.callCustom });
}

/** a scene's next line: in turn, never the one said last (`last` = its index, -1 = none) */
export function rotateLine(n: number, last: number): number {
  if (n <= 1) return 0;
  return last >= 0 && last < n ? (last + 1) % n : 0;
}

/** the placeholders filled */
export function fillLine(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(/\{([a-z]+)\}/g, (m, k: string) => (vars[k] == null ? m : String(vars[k])));
}

const PLANET_WORD: Partial<Record<BluenaPlanet, string>> = { saturn: '土星', jupiter: '木星', mercury: '水星', mars: '火星', venus: '金星', uranus: '天王星', pluto: '冥王星', neptune: '海王星' };

/**
 * each planet's own place a work goes home to (M-R208). Story 2026-11-27: goods, books and games are told too — their
 * places are the new homes' own (the ♡ line's きみのお店 / きみの図書館 / きみのゲーム小屋; PROVISIONAL wording)
 */
export const HOME_PLACE: Partial<Record<BluenaPlanet, string>> = { saturn: 'レコード', jupiter: 'アトリエ', mercury: '島', mars: 'スタジオ', venus: 'ブース', uranus: 'お店', pluto: '図書館', neptune: 'ゲーム小屋' };

/**
 * M-R253 §6 ⑥: {bati}'s report when a work comes home — the lines to say with their placeholders (render each in the
 * personality's manner first). One ★: the dachi; more: the first and how many more (under 15 the server sends the dachi
 * only); none: 「のんびり、浮かんでたって」 (no numbers). Then where it was put away.
 */
export function homecomingSay(h: Pick<HomecomingView, 'title' | 'planet' | 'named' | 'strangers'>): { text: string; vars: Record<string, string | number> }[] {
  const base = { work: (h.title || '作品').slice(0, 20), planet: PLANET_WORD[h.planet] ?? '星' };
  const all = h.named.length + h.strangers;
  const friend = h.named[0]?.name ?? 'だれか';
  const first =
    all === 0 ? { text: MOON_LINES.homeNone, vars: base } : all === 1 ? { text: MOON_LINES.homeOne, vars: { ...base, friend } } : { text: MOON_LINES.homeMany, vars: { ...base, friend, k: all - 1 } };
  const place = HOME_PLACE[h.planet];
  return place ? [first, { text: MOON_LINES.homePlace, vars: { place } }] : [first];
}
