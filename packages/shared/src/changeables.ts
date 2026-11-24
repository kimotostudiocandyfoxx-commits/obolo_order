import { KORORIN_PICS, RECORD_COLOURS, kororinOf, kororinPicId } from './planetHome';
import type { HomePlanet } from './planetHomeConfig';
import { SELF_TALK_TONES, selfTalkTone, TALK_TONES } from './talkTone';

/**
 * M-R263 (docs/story-rewrite/月の工房_作る・直す・残す.md §7): no settings buttons on the planets — the member asks
 * {bati} in the Moon chat, and {bati} changes it. The things {bati} can change, each with its choices and how to read
 * and write it through a store (the API's planet homes; the demo's browser store). Today: Saturn's record colour, the
 * kororin's picture (M-R275) and the member's own bubble colour in the talks (iPad feedback); the other planets' own places add
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
  /** M-R275: the member's kororin picture (1–24; null = not chosen) */
  kororin(): Promise<{ pic?: number | null } | null>;
  setKororin(pic: number): Promise<void>;
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
  /** more than the name: the request must be about this one */
  about?: (text: string) => boolean;
  /** what the preview card draws */
  preview: 'saturn-record' | 'kororin-pic' | 'talk-bubble';
  /** the choices to offer as chips when the choice is not said (default: all) */
  offer?: (choices: ChangeChoice[]) => ChangeChoice[];
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

/** M-R275: the member's kororin — one of the 24 pictures (「コロリンをドヤ顔にして」「コロリンを12番にして」) */
export const KORORIN_PIC: Changeable = {
  id: 'kororin.pic',
  label: 'コロリン',
  planet: 'saturn',
  choices: KORORIN_PICS.map((k) => ({ id: kororinPicId(k.n), name: k.name, words: [...k.words, k.name, `${k.n}番`] })),
  async get(store) {
    return kororinPicId(kororinOf(await store.kororin())?.pic ?? 1);
  },
  async set(store, value) {
    const k = kororinOf({ pic: value });
    if (!k) throw new Error(`not a kororin picture: ${value}`);
    await store.setKororin(k.pic);
  },
  names: /コロリン/,
  preview: 'kororin-pic',
  // 24 is too many chips: a few, spread over the faces
  offer: (cs) => [cs[1], cs[10], cs[11], cs[18], cs[16], cs[6]].filter(Boolean),
  askLine: 'どの子にする？ 顔で言ってもいいし、番号でもいいよ。',
  chip: (c) => `コロリンを${c.name}にして`,
  doneLine: (c) => `コロリン、${c.name}にしたよ！ これから飛ばすコロリンは、みんなこの子に入って届くよ。`,
  undoneLine: (c) => `元に戻したよ。コロリンは、${c.name}！`,
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

export const CHANGEABLES: Changeable[] = [SATURN_RECORD_COLOUR, KORORIN_PIC, TALK_BUBBLE_COLOUR];
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
    const wantsChange = /色|カラー|顔|かお|変え|かえ|にして|に変|にする|に塗|塗って|がいい|番/.test(t);
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
}

/** apply one choice through the store; returns what it was before (for 〔元に戻す〕) */
export async function applyChange(store: ChangeStore, id: string, value: string): Promise<ChangeResult> {
  const item = changeableById(id);
  if (!item) throw new Error(`unknown changeable: ${id}`);
  if (!item.choices.some((c) => c.id === value)) throw new Error(`not a choice of ${id}: ${value}`);
  const from = await item.get(store);
  await item.set(store, value);
  return { id, from, to: value };
}
