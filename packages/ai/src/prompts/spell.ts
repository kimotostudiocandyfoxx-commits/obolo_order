import { SONG_GENRES, type SpellKind, type SpellTag } from '@obolo/shared';

/**
 * R14 (client 2026-11-25, iPad: 「サイケデリックトランスの曲を作りたい」 came back as サイトラ + ポップ・明るい・ふつうの速さ・
 * ピアノ・ドラム・やさしい歌声): the spell (スペル) is the model's first — it understands what the member wants and builds
 * one coherent spell for it (a genre with its own tempo, instruments, voice and mood; a picture's subject, touch, mood
 * and light; a book's world and hero …). The rules (@obolo/shared spell.ts, songGenres.ts) only stand under it: they
 * fill a group the model left empty with what fits the genre, keep the dictionary's labels stable, keep the request words
 * out, and build the spell alone when the model cannot (SPELL_MODEL: Gemini Flash now, Claude by config).
 */
const WHAT: Record<SpellKind, string> = {
  song: 'a song (made by a music generator that reads English style tags)',
  art: 'a picture',
  video: 'a video made of still pictures that move (a camera over each picture, never a generated film)',
  look: "the member's own avatar look",
  bati: "the buddy character's outfit",
  novel: 'a serial novel for teenagers (its world, hero, genre, tone, length)',
  chapter: 'the next chapter of a novel (what happens, its mood, a new character)',
  game: 'a tiny HTML5 canvas game (its genre, hero, rules, goal, difficulty, look)',
};
export const SPELL_GROUPS_OF: Record<SpellKind, string[]> = {
  song: ['theme', 'genre', 'mood', 'tempo', 'instrument', 'voice'],
  art: ['theme', 'style', 'mood', 'color', 'light', 'composition'],
  video: ['theme', 'style', 'mood', 'color', 'light', 'camera', 'purpose', 'scenes', 'length', 'transition', 'caption'],
  look: ['theme', 'wear', 'style', 'color'],
  bati: ['theme', 'wear', 'style', 'color'],
  novel: ['world', 'hero', 'genre', 'mood', 'length', 'theme'],
  chapter: ['event', 'mood', 'hero', 'theme'],
  game: ['genre', 'hero', 'rule', 'goal', 'level', 'color', 'style', 'theme'],
};
const MAX: Record<SpellKind, number> = { song: 12, art: 10, video: 12, look: 8, bati: 8, novel: 8, chapter: 6, game: 8 };

const KIND_RULES: Record<SpellKind, string> = {
  song: [
    'A song spell: 1 genre (the most specific one the request means, e.g. psytrance not "trance", deep house not "house"), 1–2 moods, exactly 1 tempo (a BPM like "145BPM" when the genre has a typical one, else ゆっくり / ふつうの速さ / アップテンポ), 2–4 instruments or sound elements that define the genre, exactly 1 vocal style, and 0–3 theme tags for what the song is about (only if the request says).',
    'Everything must fit the genre. Never add a default that goes against it: no ピアノ, ドラム, やさしい歌声, ふつうの速さ or ポップ for psytrance / techno / goa (they use a four-on-the-floor kick, a rolling bassline, acid synths, minimal or ethereal vocals); no 四つ打ち for a ballad. Instrumental-leaning genres (psytrance, goa, techno, minimal, ambient, lo-fi beats, cinematic) take a voice like 声すこしだけ (minimal vocals), 浮遊する声 (ethereal) or 歌なし (instrumental) unless the user asks for singing.',
    'What the user names always wins: their genre, their instruments, their mood, their tempo. If they name a genre, keep exactly that genre.',
    `Known genres (use the Japanese label and English given here when the request is one of them; for others write your own natural label): ${SONG_GENRES.map((g) => `${g.ja} = ${g.en} [${g.guide}]`).join('; ')}.`,
  ].join('\n'),
  art: 'A picture spell: the subject and setting as theme tags (each thing the user wants to see, in their words), 1 style/touch (watercolor, anime, oil painting, pixel art, ゆめかわ yume-kawaii, 和モダン modern Japanese, レトロ retro, ポップ pop art …), 1–2 moods, 1–2 colour tags, 1 light, 1 composition. Read the intent: 「かわいい猫が宇宙を飛んでる絵」 → 猫, 宇宙, 飛ぶ as themes, cute mood, dreamy light … Fill touch / colour / light / composition with what suits the subject when the user did not say.',
  video: 'A video spell: the pictures\' subject as themes, 1 style, a mood, colour and light; purpose / scenes / length / camera / transition / caption only when the user says them (the app fills the rest).',
  look: "An avatar look: what to wear (wear), a style and colours that fit what the user wants.",
  bati: "The buddy's outfit: what to wear (wear), a style and colours that fit what the user wants.",
  novel: 'A novel spell: 1 world (where), 1 hero, 1 genre, 1 mood, 1 length, and up to 3 theme tags for what it is about. Keep the user\'s own world and hero words.',
  chapter: "A chapter spell: what happens next (event), its mood, a character who joins (hero), what it is about (theme). Keep the user's own idea in their words.",
  game: 'A game spell: 1 genre (collect / dodge / runner / shooter / tap / breakout / quiz / puzzle), 1 hero, rules, 1 goal, 1 level, a colour and a style that fit.',
};

/** the system prompt: one coherent spell for the request (fresh), or the spell made again / changed by the words */
export function spellSystem(kind: SpellKind): string {
  return [
    `You build a generation spell (スペル) for ${WHAT[kind]} in a Japanese app for children and teenagers. A spell is a list of short tags. Each tag is {"ja": a short natural Japanese label a child can read (max 12 characters, the genre's proper name, e.g. サイケデリックトランス not サイトラ), "en": the precise English term the generator understands (max 60 characters), "group": one of ${SPELL_GROUPS_OF[kind].join(', ')}}.`,
    'Understand exactly what the user wants, even from slang, abbreviations, voice-input slips or a vague wish, and make it as good as it can be: the right subgenre / style, and every tag agreeing with it.',
    KIND_RULES[kind],
    'Tags are content only. Never make a tag of the request itself: no greetings (ヤッホー), no request or politeness words (作って, 作りたい, 欲しい, お願い, ください, なんだけど), no kind words (画像, 絵, 曲, 歌, 動画), no 魔法 / スペル / プロンプト / 呪文, no corrections (違う, そうじゃなくて), no particles or grammar.',
    `At most ${MAX[kind]} tags. Never anything sexual, violent, hateful, a real person, an existing work, artist or brand.`,
    'You may get "spell_now" (the spell as it is) and "talk" (the last lines of the talk). With "spell_now": change what the words ask and keep every other tag exactly as it is (same ja, en and group) — unless the words say the spell is wrong (全然違う, 違うよ, そうじゃなくて, イメージと違う …): then build the whole spell again for what they want now, keeping only the theme tags that still fit, and set "respelled": true.',
    'You may get "rules" (what a simple dictionary made of it): use it only as a hint; it is often wrong about the genre.',
    'Return ONLY JSON: {"tags": [{"ja": "…", "en": "…", "group": "…"}, …], "respelled": false}.',
  ].join('\n');
}

export type SpellAsk = { kind: SpellKind; said: string; tags?: SpellTag[]; rules?: SpellTag[]; history?: { who: 'me' | 'bati'; text: string }[]; answers?: { group?: string; said: string }[] };

/** the request to the model: the words (and the spell now, the talk, the rules' try) */
export function spellRequest(a: SpellAsk): string {
  const tag = ({ ja, en, group }: SpellTag) => ({ ja, en, group });
  return JSON.stringify({
    request: a.said,
    ...(a.answers?.length ? { answers: a.answers } : {}),
    ...(a.tags?.length ? { spell_now: a.tags.map(tag) } : {}),
    ...(a.history?.length ? { talk: a.history.slice(-6).map((h) => `${h.who === 'me' ? 'user' : 'buddy'}: ${h.text}`) } : {}),
    ...(a.rules?.length ? { rules: a.rules.map(tag) } : {}),
  });
}

/** the model's answer → its tag pairs (unchecked: spellNormalize reads them) and whether it remade the spell */
export function parseSpellAnswer(raw: string): { tags: unknown[]; respelled: boolean } {
  let j: unknown = null;
  const text = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    j = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    try {
      j = m ? JSON.parse(m[0]) : null;
    } catch {
      j = null;
    }
  }
  const o = (j && typeof j === 'object' ? j : {}) as { tags?: unknown; respelled?: unknown };
  return { tags: Array.isArray(o.tags) ? o.tags : Array.isArray(j) ? (j as unknown[]) : [], respelled: o.respelled === true };
}
