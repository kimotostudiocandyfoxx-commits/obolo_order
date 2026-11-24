import { RECORD_COLOURS } from './planetHome';
import type { HomePlanet } from './planetHomeConfig';

/**
 * M-R263 (docs/story-rewrite/月の工房_作る・直す・残す.md §7): no settings buttons on the planets — the member asks
 * {bati} in the Moon chat, and {bati} changes it. The things {bati} can change, each with its choices and how to read
 * and write it through a store (the API's planet homes; the demo's browser store). Today: Saturn's record colour; the
 * other planets' own places add theirs here (an id, the choices, the words that name it, a getter and a setter).
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
}

export interface Changeable {
  id: string;
  /** what it is called in {bati}'s lines */
  label: string;
  planet: HomePlanet;
  choices: ChangeChoice[];
  /** the first choice is the standard one */
  get(store: ChangeStore): Promise<string>;
  set(store: ChangeStore, value: string): Promise<void>;
  /** words that name the thing itself (a request must name it) */
  names: RegExp;
  /** what the preview card draws */
  preview: 'saturn-record';
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
  // M-R263 §7's example, as written
  doneLine: (c) => `レコード、${c.name}にしたよ！ 土星に行ったら見てみて。`,
  undoneLine: (c) => `元に戻したよ。レコードは、${c.name}！`,
};

export const CHANGEABLES: Changeable[] = [SATURN_RECORD_COLOUR];
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
    if (!item.names.test(t)) continue;
    const wantsChange = /色|カラー|変え|かえ|にして|に変|にする|に塗|塗って|がいい/.test(t);
    // the longest word first (水色 before 色 words, ゴールド before 金)
    const hits = item.choices.flatMap((c) => c.words.map((w) => ({ c, w }))).filter(({ w }) => t.includes(w));
    hits.sort((a, b) => b.w.length - a.w.length);
    if (hits.length && wantsChange) return { item, choice: hits[0].c };
    const near = NEAR.find((n) => n.words.some((w) => t.includes(w)));
    if (near && wantsChange) return { item, asked: near.words.find((w) => t.includes(w))!, near: near.near.map((id) => item.choices.find((c) => c.id === id)!).filter(Boolean) };
    if (wantsChange) return { item, ask: true };
  }
  return null;
}

/** {bati}'s words (M-R263 §7, the example as written) */
export const changeLines = {
  near: (asked: string, near: ChangeChoice[]) => `${asked}は、ないんだ。${near.map((c) => c.name).join('・')}なら、できるよ！`,
  ask: () => '何色にする？',
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
