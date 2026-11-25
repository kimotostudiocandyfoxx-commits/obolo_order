import { genreChangedALot, isLyricsTalk, spellEdit, type SongLyrics, type SpellBody, type SpellTag, type SpellView } from '@obolo/shared';

/**
 * R14 (client 2026-11-25, iPad: 「全然違うよ、サイケデリックトランスにして」 → {bati} said 「歌詞はこんな感じだね」 and wrote
 * lyrics nobody asked for, and the spell stayed): while a song's spell waits, words about the genre / the sound, or a
 * correction, change the style spell (the model makes it again with the talk as context) — never the lyrics. The lyrics
 * stay; when the genre changed a lot {bati} asks once 「歌詞も、〇〇っぽく書きなおす？」.
 */
export type SongTurn = 'lyrics' | 'style';
/** what words said while a song's spell waits are about */
export const songTurnOf = (said: string, lyrics?: Pick<SongLyrics, 'blocks'> | null): SongTurn => (isLyricsTalk(said, lyrics) ? 'lyrics' : 'style');

/** the genre to ask about rewriting the lyrics for (it changed a lot and there are lyrics), or null */
export function restyleGenre(before: SpellTag[], after: SpellTag[], hasLyrics: boolean): string | null {
  if (!hasLyrics) return null;
  const a = before.find((t) => t.group === 'genre');
  const b = after.find((t) => t.group === 'genre');
  return b && genreChangedALot(a, b) ? b.ja : null;
}

/** the answer to 「歌詞も、〇〇っぽく書きなおす？」: yes, no (keep them), or neither (other words: a change of the spell) */
export function restyleAnswer(text: string): 'yes' | 'no' | null {
  const t = text.replace(/[、。,.!！?？〜~\s　♪]/g, '');
  if (!t) return null;
  if (/そのまま|このまま|今のまま|いまのまま|今ので|いまので|変えなく|かえなく|変えない|かえない|書き直さな|書きなおさな|かきなおさな|いらない|しなくて|やめとく|やめておく|大丈夫|だいじょうぶ|いいえ|ううん|ノー|^no$/i.test(t)) return 'no';
  if (/^(うん|はい|ええ|いいよ|いいね|お願い|おねがい|よろしく|オッケー|おっけー|ok|okay|書き直して|書きなおして|かきなおして|して|やって|そうして|それで|ぜひ|もちろん)+(お願い|おねがい|して|ね|よ|！)*$/i.test(t) || /書き直して|書きなおして|かきなおして|書き直そう|書きなおそう|書きかえて|書き換えて/.test(t)) return 'yes';
  return null;
}

type SpellApi = { moonSpell(body: SpellBody): Promise<SpellView> };
/**
 * the style spell changed by the words (the model, with the talk so far; by rule when the API cannot) — and the genre to
 * ask about rewriting the lyrics for. Never writes lyrics.
 */
export async function songStyleChange(api: SpellApi, o: { tags: SpellTag[]; said: string; lyrics?: SongLyrics | null; history?: SpellBody['history'] }): Promise<{ view: SpellView; restyle: string | null }> {
  const view = await api.moonSpell({ kind: 'song', said: o.said.slice(0, 200), tags: o.tags, ...(o.history?.length ? { history: o.history } : {}) }).catch((): SpellView => spellEdit('song', o.tags, o.said));
  return { view, restyle: restyleGenre(o.tags, view.tags, !!o.lyrics) };
}

/**
 * R18: the answer to 「君の声にする魔法は、◯マナだよ。唱える？」 — yes (唱えて, OK, お願い …), no (やめておく, また今度 …),
 * or neither (other words: the question is dropped and the words go on as any other).
 */
export function voiceSpellAnswer(text: string, yes: (t: string) => boolean): 'yes' | 'no' | null {
  const t = text.replace(/[、。,.!！?？〜~\s　♪]/g, '');
  if (!t) return null;
  if (/やめ|いらない|いらん|いいえ|ううん|ノー|^no$|今度|こんど|やっぱ|しない|唱えない|となえない|高い|たかい|まだいい|けっこう|結構/i.test(t)) return 'no';
  if (/唱えて|となえて|唱える|となえる|唱えよう|となえよう|かけて|お願い|おねがい|やって/.test(t) || yes(text)) return 'yes';
  return null;
}
