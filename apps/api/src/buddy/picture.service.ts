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
      let pic = q.space ? await this.nasa(q.term, q.must) : await this.commons(q.term, q.must);
      pic ??= q.space ? await this.commons(q.term, q.must) : await this.nasa(q.term, q.must);
      if (pic && (await moderateText(`${pic.title}`, this.llm)).flagged) pic = null;
      return pic ? { ...pic, free: true } : null;
    } catch (e) {
      this.log.warn(`picture failed: ${String(e)}`);
      return null;
    }
  }

  /**
   * English search words for the libraries, whether it is about space, and `must`: the thing's name, which a picture's
   * title or description has to contain (the generation test brought a castle ruin for "black hole", a cosmos flower
   * for "Big Bang" and an apple for takoyaki: a loose search is worse than no picture)
   */
  private async terms(question: string, answer?: string): Promise<{ term: string; space: boolean; must: string }> {
    const out = await this.llm
      .chat({
        system:
          'You turn a child\'s question (Japanese) into a picture search for a public image library. Reply with JSON only: {"term":"2-4 English keywords naming the thing to show","must":"the thing\'s own name in 1-2 English words, as it would appear in a picture\'s title","space":true|false}. space=true for astronomy and space topics. When the question is about the child themself (their worry, feelings, sleep, eating or body, trouble at school or at home) or asks how to do something dangerous, reply {"term":""} (no picture). Animals, food, places, science and space always get a picture. Keep it child-safe and concrete (e.g. {"term":"black hole M87","must":"black hole"}, {"term":"Saturn rings","must":"Saturn"}, {"term":"giant panda eating","must":"panda"}, {"term":"takoyaki street food","must":"takoyaki"}).',
        history: [{ role: 'user', text: `質問: ${question}${answer ? `\n答え: ${answer}` : ''}` }],
        temperature: 0,
        maxOutputTokens: 60,
      })
      .catch(() => '');
    const m = out.match(/\{[\s\S]*\}/);
    try {
      const j = JSON.parse(m?.[0] ?? '') as { term?: string; space?: boolean; must?: string };
      if (j.term) return { term: j.term.slice(0, 80), space: !!j.space, must: (j.must || j.term.split(/\s+/).slice(0, 2).join(' ')).toLowerCase().slice(0, 40) };
    } catch {
      /* fall through */
    }
    // no English name to check the pictures with: no picture
    return { term: '', space: false, must: '' };
  }

  private async nasa(term: string, must: string): Promise<Omit<BuddyPicture, 'free'> | null> {
    if (!term || !must) return null;
    const r = await fetch(`https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(term)}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { collection?: { items?: { href?: string; data?: { title?: string; description?: string; nasa_id?: string; center?: string }[]; links?: { href?: string; rel?: string }[] }[] } };
    // NASA's search is loose (a "black hole" query brought a shuttle mission patch whose description mentions black
    // holes): the thing's name (`must`) must be in the title, and patches, logos, crews and launches are skipped
    // unless asked for. Nothing left → Commons is tried instead.
    const lower = term.toLowerCase();
    const head = must;
    // also the Saturn rockets (a "Saturn" query brought "Saturn Apollo Program", a rocket, for Saturn's rings)
    const noise = /\b(patch|insignia|emblem|logo|crew|portrait|astronaut|launch|shuttle|sts-\d+|mission control|apollo|rocket|saturn v|saturn i|saturn ib|engine|test stand|skylab)\b/;
    const it = j.collection?.items
      ?.slice(0, 60)
      .find((x) => {
        const title = (x.data?.[0]?.title ?? '').toLowerCase();
        return x.links?.some((l) => l.href && /\.(jpe?g|png)$/i.test(l.href)) && (!head || title.includes(head)) && (!noise.test(title) || noise.test(lower));
      });
    const href = it?.links?.find((l) => l.href && /\.(jpe?g|png)$/i.test(l.href))?.href;
    if (!it || !href) return null;
    const d = it.data?.[0];
    return { url: href.replace(/~thumb\./, '~medium.'), title: d?.title ?? term, source: `NASA${d?.center ? `（${d.center}）` : ''}`, pageUrl: d?.nasa_id ? `https://images.nasa.gov/details/${d.nasa_id}` : 'https://images.nasa.gov' };
  }

  /** the whole words first, then the thing's name alone (a long phrase rarely matches a curated picture) */
  private async commons(term: string, must: string): Promise<Omit<BuddyPicture, 'free'> | null> {
    if (!term || !must) return null;
    for (const t of [...new Set([term, must])]) {
      const hit = await this.commonsOnce(t, must);
      if (hit) return hit;
    }
    return null;
  }

  private async commonsOnce(term: string, must: string): Promise<Omit<BuddyPicture, 'free'> | null> {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    Object.entries({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '10',
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
    const strip = (s?: string) => (s ?? '').replace(/<[^>]+>/g, '').trim();
    // the thing's name in the file's title or its description, else it is some other picture
    const about = (x: (typeof pages)[number]) => `${x.title ?? ''} ${strip(x.imageinfo?.[0]?.extmetadata?.ObjectName?.value)} ${strip(x.imageinfo?.[0]?.extmetadata?.ImageDescription?.value)}`.toLowerCase().replace(/[_-]/g, ' ');
    const p = pages.find((x) => x.imageinfo?.[0]?.thumburl && about(x).includes(must));
    const info = p?.imageinfo?.[0];
    if (!p || !info?.thumburl) return null;
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
