import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LlmProvider } from '@obolo/ai';
import { SPELL_MAX_TAGS, spellEdit, spellFrom, spellNormalize, spellOfAnswers, type SpellBody, type SpellKind, type SpellTag, type SpellView } from '@obolo/shared';
import { LLM } from '../infra/tokens';

const WHAT: Record<SpellKind, string> = { song: 'a song', art: 'a picture', video: 'a music video', look: "the member's own look", bati: "the buddy's outfit", novel: 'a serial novel for teenagers (its world, hero, tone, length)', chapter: "the next chapter of a novel (what happens, its mood, a new character)", game: 'a tiny HTML5 canvas game (its genre, hero, rules, goal, difficulty, look)' };
const GROUPS: Record<SpellKind, string> = {
  song: 'theme, genre, mood, tempo, instrument, voice',
  art: 'theme, style, mood, color, light, composition',
  video: 'theme, style, mood, light, camera',
  look: 'theme, wear, style, color',
  bati: 'theme, wear, style, color',
  novel: 'world, hero, genre, mood, length, theme',
  chapter: 'event, mood, hero, theme',
  game: 'genre, hero, rule, goal, level, color, style, theme',
};

/** the model's part of a spell: English for the free words, and a few more tags that fit (the rules' tags stay) */
export function spellSystem(kind: SpellKind): string {
  return [
    `You write a generation spell (スペル) for ${WHAT[kind]} as short tags. Each tag is a JSON object {"ja": short Japanese label (max 8 characters, plain words a child can read), "en": the short English term a generator understands, "group": one of ${GROUPS[kind]}}.`,
    'You get the request in Japanese and the tags so far. Return ONLY a JSON object {"tags": [...]} with every tag so far (same ja; give each its best English) and at most 3 new tags that fit the request well.',
    'New tags are content only — what it is about (subject, characters, place, action) and how it looks or sounds (style, mood, colour, light, composition, genre, tempo, instrument …). Never make a tag of the request itself: no greetings (ヤッホー), no request or politeness words (作って, 欲しい, お願い, ください, なんだけど), no kind words (画像, 絵, 曲, 動画), no 魔法 / スペル (that is how this world says "make it"), no particles or grammar.',
    'Never add anything sexual, violent, a real person or an existing work or brand.',
  ].join('\n');
}

/**
 * R11: POST /moon/spell — the spell's tags for the words (or the spell changed by them). The rules (the shared
 * dictionary: stable labels) make it; the model writes English for free words and may add a few fitting tags. The model
 * failing or slow (6 s) is no failure: the rules' spell stands.
 */
@Injectable()
export class SpellService {
  private readonly log = new Logger('Spell');
  constructor(@Inject(LLM) private readonly llm: LlmProvider) {}

  async spell(b: SpellBody): Promise<SpellView> {
    const base: SpellView = b.tags?.length ? spellEdit(b.kind, b.tags, b.said) : { tags: b.answers?.length ? spellOfAnswers(b.kind, b.answers) : spellFrom(b.kind, b.said), added: [], removed: [] };
    // an edit that only took tags off needs nothing more
    const free = base.tags.filter((t) => t.en === t.ja || /[^\x20-\x7e]/.test(t.en));
    if (b.tags?.length && !free.length) return base;
    try {
      const raw = await Promise.race([
        this.llm.chat({ system: spellSystem(b.kind), history: [{ role: 'user', text: JSON.stringify({ request: b.said, tags: base.tags.map(({ ja, group }) => ({ ja, group })) }) }], temperature: 0.3, maxOutputTokens: 500, json: true }),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 6000)),
      ]);
      return mergeSpell(b.kind, base, JSON.parse(raw)?.tags, !b.tags?.length);
    } catch (e) {
      this.log.warn(`spell by rules only: ${String(e)}`);
      return base;
    }
  }
}

/** the rules' spell with the model's English for its free words, and (a fresh spell) up to 3 of its extra tags */
export function mergeSpell(kind: SpellKind, base: SpellView, pairs: unknown, extras: boolean): SpellView {
  const got = spellNormalize(kind, Array.isArray(pairs) ? pairs : []);
  const english = (t: SpellTag): SpellTag => {
    if (t.en !== t.ja && !/[^\x20-\x7e]/.test(t.en)) return t;
    const m = got.find((g) => g.ja === t.ja && !/[^\x20-\x7e]/.test(g.en));
    return m ? { ...t, en: m.en } : t;
  };
  const tags = base.tags.map(english);
  const more = extras ? got.filter((g) => !tags.some((t) => t.ja === g.ja || t.en.toLowerCase() === g.en.toLowerCase() || (t.group === g.group && ['genre', 'tempo', 'voice', 'style', 'composition', 'camera'].includes(g.group)))).slice(0, 3) : [];
  // a book's / a game's spell stays at its few talismans (SPELL_MAX_TAGS): no extras past it
  const room = Math.max(0, SPELL_MAX_TAGS[kind] - tags.length);
  const extra = more.slice(0, room);
  return { tags: [...tags, ...extra].slice(0, 16), added: [...base.added.map(english), ...extra], removed: base.removed };
}
