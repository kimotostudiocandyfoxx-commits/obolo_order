import { Inject, Injectable, Logger } from '@nestjs/common';
import { parseSpellAnswer, spellRequest, spellSystem, type LlmProvider } from '@obolo/ai';
import { SONG_GENRES, SPELL_DICTIONARY, SPELL_MAX_TAGS, songGenreOf, spellComplete, spellCorrection, spellEdit, spellFrom, spellNamedTags, spellNormalize, spellOfAnswers, spellRequestWord, spellWordsOnly, type SpellBody, type SpellKind, type SpellTag, type SpellView } from '@obolo/shared';
import { SPELL_LLM } from '../infra/tokens';

/** single-tag groups (a second of them replaces the first) */
const ONE = new Set(['genre', 'tempo', 'voice', 'style', 'composition', 'camera', 'world', 'hero', 'length', 'level', 'goal', 'purpose', 'source', 'scenes', 'transition', 'caption']);
const same = (a: SpellTag, b: SpellTag) => a.ja === b.ja || a.en.toLowerCase() === b.en.toLowerCase();
const ascii = (s: string) => !/[^\x20-\x7e]/.test(s);
/** the whole ask may take this long (each model step has SPELL_MODEL_TIMEOUT_MS) before the rules' spell stands */
const ALL_MS = 15_000;

/**
 * R11 → R14 (client 2026-11-25, iPad: 「サイケデリックトランスの曲を作りたい」 gave サイトラ + ポップ・明るい・ふつうの速さ・ピアノ・
 * ドラム・やさしい歌声, and 「全然違うよ、サイケデリックトランスにして」 changed nothing): POST /moon/spell — the model first
 * (SPELL_LLM: it knows the genres and styles, reads slang and slips, and builds one coherent spell for the request or
 * makes it again on a correction, with the talk as context), the rules under it (finishSpell): the dictionary's labels,
 * the request words kept out, what the member named always in, nothing the genre goes against, and the genre's own
 * defaults only for a group left empty. The model failing or slow is no failure: the rules' spell stands (spellFrom /
 * spellEdit, genre-aware too). A plain 「〇〇は外して」 needs no model.
 */
@Injectable()
export class SpellService {
  private readonly log = new Logger('Spell');
  constructor(@Inject(SPELL_LLM) private readonly llm: LlmProvider) {}

  async spell(b: SpellBody): Promise<SpellView> {
    const fresh = !b.tags?.length;
    const correction = !fresh && spellCorrection(b.said);
    const rules: SpellView = fresh ? { tags: b.answers?.length ? spellOfAnswers(b.kind, b.answers) : spellFrom(b.kind, b.said), added: [], removed: [] } : spellEdit(b.kind, b.tags!, b.said);
    const byRules = (): SpellView => ({ ...rules, how: 'rules', ...(correction ? { respelled: true } : {}) });
    // a tag only taken off: done by rule
    if (!fresh && !correction && rules.removed.length && !rules.added.length) return byRules();
    if (this.llm.name === 'mock') return byRules();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([
        this.llm.chat({ system: spellSystem(b.kind), history: [{ role: 'user', text: spellRequest({ kind: b.kind, said: b.said, tags: b.tags, rules: rules.tags, history: b.history, answers: b.answers }) }], temperature: 0.4, maxOutputTokens: 900, json: true }),
        new Promise<never>((_, no) => (timer = setTimeout(() => no(new Error('slow')), ALL_MS))),
      ]);
      const ans = parseSpellAnswer(raw);
      const tags = finishSpell(b.kind, ans.tags, { said: b.said, now: b.tags, rules: rules.tags, fresh: fresh || correction || ans.respelled });
      if (!tags) return byRules();
      if (fresh) return { tags, added: [], removed: [], how: 'model' };
      const now = b.tags!;
      return { tags, added: tags.filter((t) => !now.some((o) => same(o, t))), removed: now.filter((o) => !tags.some((t) => same(o, t))), how: 'model', ...(correction || ans.respelled ? { respelled: true } : {}) };
    } catch (e) {
      this.log.warn(`spell by rules only: ${String(e)}`);
      return byRules();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * the model's tags made safe and whole: the dictionary's labels (a common tag always reads the same), no request words,
 * English for every tag (the rules' English where the model gave none), the genre / sound the member named in these
 * words (never the model's guess over it), nothing the genre goes against unless the member asked for it, then the
 * genre's own defaults for a group still empty — at most SPELL_MAX_TAGS. null: nothing usable came back.
 */
export function finishSpell(kind: SpellKind, pairs: unknown[], o: { said: string; now?: SpellTag[]; rules: SpellTag[]; fresh: boolean }): SpellTag[] | null {
  const raw = (pairs ?? []).filter((p): p is { ja?: unknown; en?: unknown; group?: unknown } => !!p && typeof p === 'object');
  let tags = spellNormalize(kind, raw).filter((t) => !spellRequestWord(kind, t.ja));
  if (!tags.length) return null;
  // English for the free words (the model's, else the rules' for the same label)
  tags = tags.map((t) => (ascii(t.en) && t.en !== t.ja ? t : { ...t, en: o.rules.find((r) => r.ja === t.ja && ascii(r.en))?.en ?? t.en }));
  // what the member named in these words always wins (their genre, instruments, tempo, voice …)
  const words = spellWordsOnly(o.said);
  const named = spellNamedTags(kind, o.said).filter((t) => t.group !== 'theme');
  const genresNamed = kind === 'song' ? SONG_GENRES.filter((g) => g.re.test(words)) : [];
  for (const t of named) {
    if (t.group === 'genre' && kind === 'song' && genresNamed.length > 1) continue; // 「ポップからテクノに」: the model reads which
    if (tags.some((x) => same(x, t))) continue;
    // the model's own tag already says it, more exactly (メガネの少年 for 少年, ローファイヒップホップ for ローファイ)
    const re = SPELL_DICTIONARY.find((x) => x.ja === t.ja)?.re;
    if (re && tags.some((x) => x.group === t.group && re.test(x.ja))) continue;
    // in an edit only what these words put on (the rules' change), on a fresh / remade spell everything they name
    if (!o.fresh && !o.rules.some((r) => same(r, t))) continue;
    // a song's sound words are names (ロック, ピアノ, 145BPM); a picture's / a book's dictionary only guesses (森 → 魔法の森):
    // those only fill a group the model left empty
    if (ONE.has(t.group) && tags.some((x) => x.group === t.group)) {
      if (kind !== 'song') continue;
      tags = tags.filter((x) => x.group !== t.group);
    }
    tags.push(t);
  }
  if (kind === 'song') {
    const genre = songGenreOf(tags.find((t) => t.group === 'genre'));
    const asked = (t: SpellTag) => named.some((n) => same(n, t)) || (!o.fresh && !!o.now?.some((n) => same(n, t)) && !genreSwitched(o.now, tags));
    if (genre?.avoid?.length) tags = tags.filter((t) => t.group === 'genre' || !genre.avoid!.includes(t.ja) || asked(t));
  }
  return spellComplete(kind, tags).slice(0, SPELL_MAX_TAGS[kind]);
}

/** the genre is not the one the spell had (what the old genre brought may go) */
const genreSwitched = (now: SpellTag[] | undefined, tags: SpellTag[]) => {
  const a = now?.find((t) => t.group === 'genre');
  const b = tags.find((t) => t.group === 'genre');
  return !!b && (!a || !same(a, b));
};
