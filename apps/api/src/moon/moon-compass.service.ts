import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { compassSpellPrompt, compassTitlePrompt, moderateText, type LlmProvider } from '@obolo/ai';
import { spellComplete, spellNormalize, youtubeLink, type CompassSpell, type MoonCompassBody, type SpellGroup, type SpellTag } from '@obolo/shared';
import { apiError } from '../common/errors';
import { LLM } from '../infra/tokens';
import { FilesService } from '../media/files.service';

const GROUPS: Record<CompassSpell['kind'], SpellGroup[]> = {
  art: ['theme', 'style', 'mood', 'color', 'light', 'composition'],
  song: ['theme', 'genre', 'mood', 'tempo', 'instrument', 'voice'],
};
/** the short Latin words a label may keep (EDM, SF, 3D …) */
const LATIN_OK = /^(EDM|SF|3D|R&B|J-?POP|LO-?FI|MV|DJ)$/i;
/** words that point at someone, not at a sound or a look */
const POINTING = /\b(by|feat\.?|ft\.?|featuring\s+[A-Z]|in the style of|style of|sounds? like|like)\b/i;
const CAPS_RUN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/;

/**
 * a read spell: the model's tags in the dictionary's own labels, only the kind's groups, and nothing that names
 * someone — a tag carrying the video's title / channel words, "by …", "like …", a run of Capitalised Words, or a
 * label in Latin letters — is dropped
 */
export function cleanRead(kind: CompassSpell['kind'], raw: string, names: string[] = []): SpellTag[] {
  let pairs: unknown[] = [];
  try {
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { tags?: unknown };
    pairs = Array.isArray(j.tags) ? j.tags : [];
  } catch {
    pairs = [];
  }
  // the channel's words, the title as a whole, and the title's longer Japanese words (a general English word in a
  // title — night, summer — may still describe the sound)
  const [title = '', ...who] = names;
  const split = (n: string) => n.split(/[\s\-–—|/()（）「」『』【】\[\]・,、。!！?？"'“”]+/).map((w) => w.trim().toLowerCase());
  const stop = /^(official|music|video|mv|audio|lyric|lyrics|feat|ft|the|and|live|ver|version|topic|channel|公式|歌ってみた)$/i;
  const bare = title.replace(/[(（\[【].*?[)）\]】]/g, '').trim().toLowerCase();
  const words = [
    ...who.flatMap(split).filter((w) => [...w].length >= 2 && !stop.test(w)),
    ...(bare.length >= 3 ? [bare] : []),
    ...split(title).filter((w) => /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(w) && [...w].length >= 3 && !stop.test(w)),
  ];
  const named = (s: string) => words.some((w) => s.toLowerCase().includes(w));
  const ok = (p: { ja?: unknown; en?: unknown }) => {
    const ja = typeof p.ja === 'string' ? p.ja : '';
    const en = typeof p.en === 'string' ? p.en : '';
    if (!ja || !en) return false;
    if (named(ja) || named(en)) return false;
    if (POINTING.test(en) || CAPS_RUN.test(en)) return false;
    const latin = ja.match(/[A-Za-z&-]{2,}/g) ?? [];
    return latin.every((w) => LATIN_OK.test(w));
  };
  return spellNormalize(kind, (pairs as { ja?: unknown; en?: unknown; group?: unknown }[]).filter((p) => p && typeof p === 'object' && ok(p))).filter((t) => GROUPS[kind].includes(t.group));
}

/**
 * R12 (client 2026-11-25): POST /moon/compass — {bati}'s コンパス reads a spell from something. A photo handed to
 * {bati} (your own 📎 file) or a pasted image → a picture spell (touch, colours, light, composition, what is in it). A
 * YouTube link → a song spell: the model watches the video itself (Gemini takes the link as video input; nothing is
 * downloaded); when it can not, YouTube's oEmbed title and channel are only a hint for the model to guess the style.
 * "In the style of" tags only: never the lyrics, the title or anyone's name (the prompt says so, cleanRead drops what
 * slips through, the text check runs on the labels). Nothing is kept; no mana.
 */
@Injectable()
export class MoonCompassService {
  private readonly log = new Logger('MoonCompass');
  constructor(
    @Inject(LLM) private readonly llm: LlmProvider,
    private readonly files: FilesService,
  ) {}

  async read(userId: string, b: MoonCompassBody): Promise<CompassSpell> {
    if (b.url) return this.song(youtubeLink(b.url)!);
    const img = b.fileId ? await this.files.photo(userId, b.fileId) : b.image ? { mime: b.image.mime, data: Buffer.from(b.image.data, 'base64') } : null;
    if (!img) throw apiError(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', 'Photo not found');
    if (!this.llm.perceive) throw this.cannot();
    const raw = await this.within(this.llm.perceive(img, compassSpellPrompt('art')), 30_000).catch((e) => {
      this.log.warn(`compass (picture) failed: ${String(e)}`);
      return '';
    });
    return this.done('art', cleanRead('art', raw), 'image');
  }

  private async song(url: string): Promise<CompassSpell> {
    const meta = await this.oembed(url).catch(() => null);
    const names = meta ? [meta.title, meta.author] : [];
    if (this.llm.perceive) {
      const raw = await this.within(this.llm.perceive({ url }, compassSpellPrompt('song')), 45_000).catch((e) => {
        this.log.warn(`compass (video) failed, the title next: ${String(e)}`);
        return '';
      });
      const tags = cleanRead('song', raw, names);
      if (tags.length >= 3) return this.done('song', tags, 'video');
    }
    if (!meta) throw this.cannot();
    const raw = await this.within(this.llm.chat({ system: compassTitlePrompt(), history: [{ role: 'user', text: JSON.stringify({ title: meta.title, channel: meta.author }) }], temperature: 0.4, maxOutputTokens: 600, json: true }), 12_000).catch(() => '');
    return this.done('song', cleanRead('song', raw, names), 'title');
  }

  private async done(kind: CompassSpell['kind'], tags: SpellTag[], via: CompassSpell['via']): Promise<CompassSpell> {
    if (tags.length < 2) throw this.cannot();
    if ((await moderateText(tags.map((t) => t.ja).join('、'), this.llm)).flagged) throw this.cannot();
    return { kind, tags: spellComplete(kind, tags), via };
  }

  /** YouTube's public oEmbed: the video's title and channel (only a hint; never shown, never a tag) */
  protected async oembed(url: string): Promise<{ title: string; author: string } | null> {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: unknown; author_name?: unknown };
    return typeof j.title === 'string' ? { title: j.title.slice(0, 200), author: typeof j.author_name === 'string' ? j.author_name.slice(0, 100) : '' } : null;
  }

  private within<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), ms))]);
  }
  private cannot() {
    return apiError(HttpStatus.BAD_GATEWAY, 'COMPASS_FAILED', 'コンパスが読めなかった');
  }
}
