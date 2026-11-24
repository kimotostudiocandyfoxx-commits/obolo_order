import { KORORIN_COLOURS, KORORIN_FACES, RECORD_COLOURS, isKororinColour, isKororinFace, kororinOf } from './planetHome';
import type { HomePlanet } from './planetHomeConfig';
import { SELF_TALK_TONES, selfTalkTone, TALK_TONES } from './talkTone';

/**
 * M-R263 (docs/story-rewrite/月の工房_作る・直す・残す.md §7): no settings buttons on the planets — the member asks
 * {bati} in the Moon chat, and {bati} changes it. The things {bati} can change, each with its choices and how to read
 * and write it through a store (the API's planet homes; the demo's browser store). Today: Saturn's record colour, the
 * kororin (M-R266) and the member's own bubble colour in the talks (iPad feedback); the other planets' own places add
 * theirs here (an id, the choices, the words that name it, a getter and a setter).
 */
export interface ChangeChoice {
  id: string;
  name: string;
  /** the words a member may use for it */
  words: string[];
  /** the colour shown in the preview (null: as painted) */
  color?: string | null;
}

/** where a changeable is kept: a planet home's own choices (the API: planet_homes; the demo: the browser) */
export interface ChangeStore {
  home(planet: HomePlanet): Promise<{ recordColour?: string | null } | null>;
  setHome(planet: HomePlanet, patch: { recordColour?: string }): Promise<void>;
  /** M-R266: the member's kororin (colour + face) */
  kororin(): Promise<{ colour?: string | null; face?: string | null } | null>;
  setKororin(patch: { colour?: string; face?: string }): Promise<void>;
  /** iPad feedback: the member's own bubble colour (Me.story 'sys.talk_color'; null = never changed) */
  talkColour(): Promise<string | null>;
  setTalkColour(id: string): Promise<void>;
}

export interface Changeable {
  id: string;
  /** what it is called in {bati}'s lines */
  label: string;
  /** the planet it belongs to (none: it is the member's own, everywhere — the bubble colour) */
  planet?: HomePlanet;
  choices: ChangeChoice[];
  /** the first choice is the standard one */
  get(store: ChangeStore): Promise<string>;
  set(store: ChangeStore, value: string): Promise<void>;
  /** words that name the thing itself (a request must name it) */
  names: RegExp;
  /** more than the name: the request must be about this one (the kororin's face, not its colour) */
  about?: (text: string) => boolean;
  /** what the preview card draws */
  preview: 'saturn-record' | 'kororin-colour' | 'kororin-face' | 'talk-bubble';
  /** colours that are not among its choices → the nearest few that are (else the shared NEAR list) */
  near?: { words: string[]; near: string[] }[];
  /** {bati}'s question when the choice is not said */
  askLine: string;
  /** a chip the member can tap for one choice (the words read back as that request) */
  chip(choice: ChangeChoice): string;
  /** {bati}'s words when it changed it / put it back */
  doneLine(choice: ChangeChoice): string;
  undoneLine(choice: ChangeChoice): string;
}

const COLOUR_WORDS: Record<string, string[]> = {
  black: ['黒', 'くろ', 'クロ', 'ブラック'],
  pink: ['ピンク', '桃', 'もも色'],
  lavender: ['ラベンダー', '紫', 'むらさき', 'パープル'],
  mint: ['ミント', '緑', 'みどり', 'グリーン'],
  gold: ['ゴールド', '金', 'きん色', '黄色', 'きいろ', 'イエロー'],
  sky: ['空色', 'そら色', '水色', 'みずいろ', '青', 'あお', 'ブルー', 'スカイ'],
};

export const SATURN_RECORD_COLOUR: Changeable = {
  id: 'saturn.recordColour',
  label: '土星のレコード',
  planet: 'saturn',
  choices: RECORD_COLOURS.map((c) => ({ id: c.id, name: c.name, words: COLOUR_WORDS[c.id] ?? [c.name], color: c.color })),
  async get(store) {
    return (await store.home('saturn'))?.recordColour ?? 'black';
  },
  async set(store, value) {
    if (!RECORD_COLOURS.some((c) => c.id === value)) throw new Error(`not a record colour: ${value}`);
    await store.setHome('saturn', { recordColour: value });
  },
  names: /レコード/,
  preview: 'saturn-record',
  askLine: '何色にする？',
  chip: (c) => `レコードを${c.name}にして`,
  // M-R263 §7's example, as written
  doneLine: (c) => `レコード、${c.name}にしたよ！ 土星に行ったら見てみて。`,
  undoneLine: (c) => `元に戻したよ。レコードは、${c.name}！`,
};

const KORORIN_COLOUR_WORDS: Record<string, string[]> = {
  pearl: ['パール', '白', 'しろ', 'ホワイト', 'しろもち'],
  gold: ['ゴールド', '金', 'きん色', '黄色', 'きいろ', 'イエロー', 'きんぴか'],
  pink: ['ピンク', '桃', 'もも色'],
  mint: ['ミント', '緑', 'みどり', 'グリーン'],
  lavender: ['ラベンダー', '紫', 'むらさき', 'パープル'],
  sky: ['空色', 'そら色', '水色', 'みずいろ', '青', 'あお', 'ブルー', 'スカイ'],
  peach: ['ピーチ', 'オレンジ', 'だいだい', 'ぴーち'],
  night: ['夜色', 'よる色', '紺', 'ネイビー', '黒', 'くろ', 'ブラック', 'よぞら'],
};
const KORORIN_FACE_WORDS: Record<string, string[]> = {
  omega: ['ω', 'オメガ'],
  smile: ['にっこり', 'ニッコリ', '笑顔', 'えがお'],
  wink: ['ウインク', 'ウィンク'],
  sleepy: ['ねむい', '眠い', 'ねむそう', '眠そう'],
  cat: ['ねこ口', '猫口', 'ねこ', '猫'],
  oh: ['びっくり', 'ビックリ', 'おどろ'],
  grin: ['にかっ', 'ニカッ', '歯'],
  star: ['キラキラ', 'きらきら', '星の目', 'ほしの目'],
};
const faceWords = Object.values(KORORIN_FACE_WORDS).flat();

/** M-R266: the member's kororin — its colour, and its face (any colour with any face) */
export const KORORIN_COLOUR: Changeable = {
  id: 'kororin.colour',
  label: 'コロリンの色',
  planet: 'saturn',
  choices: KORORIN_COLOURS.map((c) => ({ id: c.id, name: c.name, words: KORORIN_COLOUR_WORDS[c.id] ?? [c.name] })),
  async get(store) {
    return kororinOf(await store.kororin()).colour;
  },
  async set(store, value) {
    if (!isKororinColour(value)) throw new Error(`not a kororin colour: ${value}`);
    await store.setKororin({ colour: value });
  },
  names: /コロリン/,
  about: (t) => !/顔|かお/.test(t),
  preview: 'kororin-colour',
  askLine: 'コロリン、何色にする？',
  chip: (c) => `コロリンを${c.name}にして`,
  doneLine: (c) => `コロリン、${c.name}にしたよ！ これから飛ばすコロリンは、みんなこの子に入って届くよ。`,
  undoneLine: (c) => `元に戻したよ。コロリンの色は、${c.name}！`,
};
export const KORORIN_FACE: Changeable = {
  id: 'kororin.face',
  label: 'コロリンの顔',
  planet: 'saturn',
  choices: KORORIN_FACES.map((c) => ({ id: c.id, name: c.name, words: KORORIN_FACE_WORDS[c.id] ?? [c.name] })),
  async get(store) {
    return kororinOf(await store.kororin()).face;
  },
  async set(store, value) {
    if (!isKororinFace(value)) throw new Error(`not a kororin face: ${value}`);
    await store.setKororin({ face: value });
  },
  names: /コロリン/,
  about: (t) => /顔|かお/.test(t) || faceWords.some((w) => t.includes(w)),
  preview: 'kororin-face',
  askLine: 'コロリン、どんな顔にする？',
  chip: (c) => `コロリンの顔を${c.name}にして`,
  doneLine: (c) => `コロリンの顔、${c.name}にしたよ！ かわいい！`,
  undoneLine: (c) => `元に戻したよ。コロリンの顔は、${c.name}！`,
};

const TALK_COLOUR_WORDS: Record<string, string[]> = {
  pearl: ['月光パール', 'パール', '白', 'しろ', 'ホワイト', '月光'],
  sky: ['霧の空色', '空色', 'そら色', '水色', 'みずいろ', '青', 'あお', 'ブルー', 'スカイ'],
  rose: ['くすみローズ', 'ローズ', 'ピンク', '桃', 'もも色', 'バラ', 'ばら'],
  sage: ['セージ', '緑', 'みどり', 'グリーン', 'ミント'],
  apricot: ['杏', 'あんず', 'アプリコット', 'オレンジ', 'だいだい', 'ピーチ'],
  lilac: ['ライラック', '紫', 'むらさき', 'パープル', 'ラベンダー'],
};

/**
 * iPad feedback: the member's own bubble colour in the talks (no picker at the first talk any more: everyone starts
 * with 月光パール). 「吹き出しを水色にして」 — {bati} changes it, with the card and 〔元に戻す〕, like the others.
 */
export const TALK_BUBBLE_COLOUR: Changeable = {
  id: 'talk.bubbleColour',
  label: '吹き出しの色',
  choices: SELF_TALK_TONES.map((id) => ({ id, name: TALK_TONES[id].name, words: TALK_COLOUR_WORDS[id] ?? [TALK_TONES[id].name], color: TALK_TONES[id].line })),
  async get(store) {
    return selfTalkTone(await store.talkColour());
  },
  async set(store, value) {
    if (!(SELF_TALK_TONES as readonly string[]).includes(value)) throw new Error(`not a bubble colour: ${value}`);
    await store.setTalkColour(value);
  },
  names: /吹き?出し|ふきだし|フキダシ|バブル|(?:チャット|トーク|会話|かいわ|メッセージ|ことば|言葉)の色/,
  preview: 'talk-bubble',
  near: [
    { words: ['赤', 'あか', 'レッド'], near: ['rose', 'apricot'] },
    { words: ['黄色', 'きいろ', 'イエロー', 'ゴールド', '金', '茶', 'ちゃいろ', 'ブラウン'], near: ['apricot', 'pearl'] },
    { words: ['黒', 'くろ', 'ブラック', '紺', 'ネイビー'], near: ['lilac', 'sky'] },
    { words: ['銀', 'シルバー', '灰色', 'グレー'], near: ['sky', 'pearl', 'lilac'] },
    { words: ['虹', 'にじ', 'レインボー'], near: ['rose', 'sky', 'sage'] },
  ],
  askLine: '吹き出し、何色にする？',
  chip: (c) => `吹き出しを${c.name}にして`,
  doneLine: (c) => `吹き出し、${c.name}にしたよ！`,
  undoneLine: (c) => `元に戻したよ。吹き出しは、${c.name}！`,
};

export const CHANGEABLES: Changeable[] = [SATURN_RECORD_COLOUR, KORORIN_FACE, KORORIN_COLOUR, TALK_BUBBLE_COLOUR];
export const changeableById = (id: string) => CHANGEABLES.find((c) => c.id === id);

/** colours that are not among the choices → the nearest few that are */
const NEAR: { words: string[]; near: string[] }[] = [
  { words: ['赤', 'あか', 'レッド'], near: ['pink', 'gold', 'lavender'] },
  { words: ['白', 'しろ', 'ホワイト'], near: ['sky', 'mint', 'lavender'] },
  { words: ['オレンジ', 'だいだい'], near: ['gold', 'pink'] },
  { words: ['茶', 'ちゃいろ', 'ブラウン'], near: ['gold', 'black'] },
  { words: ['銀', 'シルバー', '灰色', 'グレー'], near: ['sky', 'black', 'lavender'] },
  { words: ['虹', 'にじ', 'レインボー'], near: ['pink', 'mint', 'sky'] },
];

export type ChangeRequest =
  | { item: Changeable; choice: ChangeChoice }
  | { item: Changeable; asked: string; near: ChangeChoice[] }
  | { item: Changeable; ask: true };

/**
 * 「土星のレコード、ピンクにして」 / 「レコードの色を変えたい」 / 「レコードを赤に」: which thing, and which choice (or the
 * nearest choices, or a question). null when the words are not about a changeable thing.
 */
export function changeRequest(text: string): ChangeRequest | null {
  const t = text.replace(/\s+/g, '');
  for (const item of CHANGEABLES) {
    if (!item.names.test(t) || (item.about && !item.about(t))) continue;
    const wantsChange = /色|カラー|顔|かお|変え|かえ|にして|に変|にする|に塗|塗って|がいい/.test(t);
    // the longest word first (水色 before 色 words, ゴールド before 金)
    const hits = item.choices.flatMap((c) => c.words.map((w) => ({ c, w }))).filter(({ w }) => t.includes(w));
    hits.sort((a, b) => b.w.length - a.w.length);
    if (hits.length && wantsChange) return { item, choice: hits[0].c };
    const near = (item.near ?? NEAR).find((n) => n.words.some((w) => t.includes(w)));
    const nearChoices = near ? near.near.map((id) => item.choices.find((c) => c.id === id)!).filter(Boolean) : [];
    if (near && nearChoices.length && wantsChange) return { item, asked: near.words.find((w) => t.includes(w))!, near: nearChoices };
    if (wantsChange) return { item, ask: true };
  }
  return null;
}

/** {bati}'s words (M-R263 §7, the example as written) */
export const changeLines = {
  near: (asked: string, near: ChangeChoice[]) => `${asked}は、ないんだ。${near.map((c) => c.name).join('・')}なら、できるよ！`,
  ask: (item?: Changeable) => item?.askLine ?? '何色にする？',
};

/** a change {bati} made (the card in the chat: the preview, and 〔元に戻す〕 back to `from`) */
export interface ChangeResult {
  id: string;
  from: string;
  to: string;
  /** M-R266: a kororin change carries the whole kororin after it (the preview draws the colour with its face) */
  kororin?: { colour: string; face: string };
}

/** apply one choice through the store; returns what it was before (for 〔元に戻す〕) */
export async function applyChange(store: ChangeStore, id: string, value: string): Promise<ChangeResult> {
  const item = changeableById(id);
  if (!item) throw new Error(`unknown changeable: ${id}`);
  if (!item.choices.some((c) => c.id === value)) throw new Error(`not a choice of ${id}: ${value}`);
  const from = await item.get(store);
  await item.set(store, value);
  if (item.preview === 'kororin-colour' || item.preview === 'kororin-face') return { id, from, to: value, kororin: kororinOf(await store.kororin()) };
  return { id, from, to: value };
}
