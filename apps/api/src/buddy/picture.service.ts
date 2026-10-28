import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type LlmProvider, moderateText } from '@obolo/ai';
import type { BuddyPicture } from '@obolo/shared';
import { apiError } from '../common/errors';
import { LLM } from '../infra/tokens';

const UA = 'OboloOrder/1.0 (kids space app; contact via app)';

/**
 * 〔🖼 絵で見る〕 (M-R138〜140): a picture for Bati's answer, only from libraries whose pictures may be used —
 * NASA's Image and Video Library (space, mostly public domain) and Wikimedia Commons' curated "Quality images"
 * (free licences, author and licence shown). Both are free to call. The question is checked first, the search
 * words are made by the LLM (English keywords), and the picture's own title is checked again. No mana, for anyone
 * (M-R147: the sources are free). A wider web search would come later as 〔もっと広く探す〕 with a little mana.
 */
@Injectable()
export class PictureService {
  private readonly log = new Logger('Picture');
  constructor(@Inject(LLM) private readonly llm: LlmProvider) {}

  async find(userId: string, question: string, answer?: string): Promise<BuddyPicture | null> {
    if ((await moderateText(question, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'この質問の絵は、出せないよ');
    try {
      const q = await this.terms(question, answer);
      let pic = q.space ? await this.nasa(q.term) : await this.commons(q.term);
      pic ??= q.space ? await this.commons(q.term) : await this.nasa(q.term);
      if (pic && (await moderateText(`${pic.title}`, this.llm)).flagged) pic = null;
      return pic ? { ...pic, free: true } : null;
    } catch (e) {
      this.log.warn(`picture failed: ${String(e)}`);
      return null;
    }
  }

  /** English search words for the libraries, and whether it is about space */
  private async terms(question: string, answer?: string): Promise<{ term: string; space: boolean }> {
    const out = await this.llm
      .chat({
        system:
          'You turn a child\'s question (Japanese) into a picture search for a public image library. Reply with JSON only: {"term":"2-4 English keywords naming the thing to show","space":true|false}. space=true for astronomy and space topics. Keep it child-safe and concrete (e.g. "black hole M87", "Saturn rings", "giant panda").',
        history: [{ role: 'user', text: `質問: ${question}${answer ? `\n答え: ${answer}` : ''}` }],
        temperature: 0,
        maxOutputTokens: 60,
      })
      .catch(() => '');
    const m = out.match(/\{[\s\S]*\}/);
    try {
      const j = JSON.parse(m?.[0] ?? '') as { term?: string; space?: boolean };
      if (j.term) return { term: j.term.slice(0, 80), space: !!j.space };
    } catch {
      /* fall through */
    }
    return { term: question.slice(0, 40), space: /宇宙|星|惑星|銀河|ブラックホール|月|太陽|ロケット/.test(question) };
  }

  private async nasa(term: string): Promise<Omit<BuddyPicture, 'free'> | null> {
    const r = await fetch(`https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(term)}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { collection?: { items?: { href?: string; data?: { title?: string; description?: string; nasa_id?: string; center?: string }[]; links?: { href?: string; rel?: string }[] }[] } };
    // NASA's search is loose (a "black hole" query can bring a space shuttle first): only an item whose title or
    // description names the thing counts
    const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const names = (x: { data?: { title?: string; description?: string }[] }) => `${x.data?.[0]?.title ?? ''} ${x.data?.[0]?.description ?? ''}`.toLowerCase();
    const it = j.collection?.items?.slice(0, 40).find((x) => x.links?.some((l) => l.href && /\.(jpe?g|png)$/i.test(l.href)) && (!words.length || words.every((w) => names(x).includes(w))));
    const href = it?.links?.find((l) => l.href && /\.(jpe?g|png)$/i.test(l.href))?.href;
    if (!it || !href) return null;
    const d = it.data?.[0];
    return { url: href.replace(/~thumb\./, '~medium.'), title: d?.title ?? term, source: `NASA${d?.center ? `（${d.center}）` : ''}`, pageUrl: d?.nasa_id ? `https://images.nasa.gov/details/${d.nasa_id}` : 'https://images.nasa.gov' };
  }

  /** the whole words first, then fewer of them (a long phrase rarely matches a curated picture) */
  private async commons(term: string): Promise<Omit<BuddyPicture, 'free'> | null> {
    const words = term.split(/\s+/).filter(Boolean);
    for (const t of [...new Set([words.join(' '), words.slice(0, 2).join(' '), words[0]])].filter(Boolean)) {
      const hit = await this.commonsOnce(t);
      if (hit) return hit;
    }
    return null;
  }

  private async commonsOnce(term: string): Promise<Omit<BuddyPicture, 'free'> | null> {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    Object.entries({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '5',
      gsrsearch: `${term} incategory:Quality_images filetype:bitmap`,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '800',
      origin: '*',
    }).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    type Info = { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> };
    const j = (await r.json()) as { query?: { pages?: Record<string, { title?: string; index?: number; imageinfo?: Info[] }> } };
    const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const p = pages.find((x) => x.imageinfo?.[0]?.thumburl);
    const info = p?.imageinfo?.[0];
    if (!p || !info?.thumburl) return null;
    const strip = (s?: string) => (s ?? '').replace(/<[^>]+>/g, '').trim();
    // the author's name only (some pages put a whole note in the field: then it is left out)
    const rawArtist = strip(info.extmetadata?.Artist?.value).split('\n')[0].trim();
    const artist = rawArtist.length <= 30 && !/[:：]/.test(rawArtist) ? rawArtist : '';
    const licence = strip(info.extmetadata?.LicenseShortName?.value).slice(0, 30);
    return {
      url: info.thumburl,
      title: strip(info.extmetadata?.ObjectName?.value) || (p.title ?? term).replace(/^File:/, '').replace(/\.\w+$/, ''),
      source: ['Wikimedia Commons', artist, licence].filter(Boolean).join(' / '),
      pageUrl: info.descriptionurl ?? 'https://commons.wikimedia.org',
    };
  }
}
