import { Inject, Injectable, Logger } from '@nestjs/common';
import { barePreview, linkKind, youtubeId, type LinkPreview } from '@obolo/shared';
import { createHash } from 'node:crypto';
import sharp, { type Sharp } from 'sharp';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { checkUrl, FetchRefused, safeFetch, type SafeFetchOptions } from './guard';
import { decodeHtml, parseMeta } from './meta';

/** the limits of one unfurl (docs: the R12 report) */
export const UNFURL = {
  /** a page: only its first 512 KB is read (the <head> is near the top) */
  pageBytes: 512 * 1024,
  /** a picture: refused over 3 MB, drawn at ≤ 480 px */
  imageBytes: 3 * 1024 * 1024,
  iconBytes: 256 * 1024,
  /** the page, its picture and its icon each get this long, all together at most `totalMs` */
  hopMs: 4000,
  totalMs: 8000,
  maxRedirects: 3,
  imagePx: 480,
  /** cached: a read page a day, a failure half an hour */
  ttlOk: 24 * 3600,
  ttlFail: 30 * 60,
} as const;

/** the providers whose oEmbed says more than their pages (title, author, thumbnail); fetched under the same rules */
const OEMBED: Partial<Record<LinkPreview['kind'], (u: string) => string>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
};
const SITE: Partial<Record<LinkPreview['kind'], string>> = { youtube: 'YouTube', spotify: 'Spotify', soundcloud: 'SoundCloud' };

export type Fetcher = typeof safeFetch;

/**
 * R12: POST /links/unfurl — a pasted link's preview for its portal in the talk: title, site, description, picture and
 * icon. Read through the SSRF-safe fetch (guard.ts); pictures re-encoded here to small WebP / PNG data: URLs so the talk
 * never loads anything from the linked site (no tracking, no mixed content). Cached in Redis by URL.
 */
@Injectable()
export class LinksService {
  private readonly log = new Logger('Links');
  /** tests: a fetcher with its own resolver */
  fetcher: Fetcher = safeFetch;
  constructor(@Inject(KV) private readonly kv: KvStore) {}

  static key(url: string) {
    return `unfurl:v1:${createHash('sha256').update(url).digest('hex').slice(0, 40)}`;
  }

  /** the cached preview, or null (a miss: the caller rate-limits, then `read`) */
  async cached(url: string): Promise<LinkPreview | null> {
    const hit = await this.kv.get(LinksService.key(url)).catch(() => null);
    if (!hit) return null;
    try {
      return JSON.parse(hit) as LinkPreview;
    } catch {
      return null;
    }
  }

  async unfurl(url: string): Promise<LinkPreview> {
    checkUrl(url);
    const hit = await this.cached(url);
    if (hit) return hit;
    return this.read(url);
  }

  async read(url: string): Promise<LinkPreview> {
    const deadline = Date.now() + UNFURL.totalMs;
    const left = () => Math.max(300, Math.min(UNFURL.hopMs, deadline - Date.now()));
    const opts = (o: Partial<SafeFetchOptions> & Pick<SafeFetchOptions, 'maxBytes' | 'over'>): SafeFetchOptions => ({ timeoutMs: left(), maxRedirects: UNFURL.maxRedirects, ...o });
    let p: LinkPreview = barePreview(url);
    let imageUrl: string | null = null;
    let icons: string[] = [];
    try {
      const kind = linkKind(url);
      const oembed = OEMBED[kind];
      if (oembed) {
        const r = await this.fetcher(oembed(url), opts({ maxBytes: 64 * 1024, over: 'refuse', accept: 'application/json' }));
        const j = JSON.parse(r.body.toString('utf8')) as { title?: string; author_name?: string; provider_name?: string; thumbnail_url?: string };
        const yt = youtubeId(url);
        p = { ...p, ok: true, title: short(j.title, 120), siteName: SITE[kind] ?? short(j.provider_name, 60), description: short(j.author_name, 200) };
        imageUrl = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : (j.thumbnail_url ?? null);
      } else {
        const r = await this.fetcher(url, opts({ maxBytes: UNFURL.pageBytes, over: 'cut', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' }));
        p.finalUrl = r.url;
        if (r.type.startsWith('image/')) {
          imageUrl = r.url;
          p = { ...p, ok: true, title: decodeURIComponent(new URL(r.url).pathname.split('/').pop() ?? '') || null };
        } else if (r.type === 'text/html' || r.type === 'application/xhtml+xml' || !r.type) {
          const m = parseMeta(decodeHtml(r.body, r.charset), r.url);
          p = { ...p, ok: true, title: m.title, siteName: m.siteName, description: m.description };
          imageUrl = m.image;
          icons = [...m.icons, new URL('/favicon.png', r.url).toString()];
        } else p = { ...p, ok: true };
      }
    } catch (e) {
      this.log.debug(`unfurl failed ${e instanceof FetchRefused ? e.code : String(e)}`);
    }
    if (p.ok) {
      const [image, favicon] = await Promise.all([
        imageUrl ? this.picture(imageUrl, UNFURL.imageBytes, left(), (s) => s.resize(UNFURL.imagePx, UNFURL.imagePx, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 68 }), 'image/webp') : null,
        this.firstIcon(icons, left),
      ]);
      p = { ...p, image, favicon };
    }
    await this.kv.set(LinksService.key(url), JSON.stringify(p), p.ok ? UNFURL.ttlOk : UNFURL.ttlFail).catch(() => undefined);
    return p;
  }

  private async firstIcon(icons: string[], left: () => number): Promise<string | null> {
    for (const href of icons.slice(0, 2)) {
      const d = await this.picture(href, UNFURL.iconBytes, Math.min(2500, left()), (s) => s.resize(64, 64, { fit: 'cover' }).png({ compressionLevel: 9 }), 'image/png');
      if (d) return d;
    }
    return null;
  }

  /** a picture through the guard, drawn small (never SVG: it could point elsewhere); null when anything fails */
  private async picture(href: string, maxBytes: number, timeoutMs: number, draw: (s: Sharp) => Sharp, mime: string): Promise<string | null> {
    try {
      const r = await this.fetcher(href, { maxBytes, timeoutMs, maxRedirects: UNFURL.maxRedirects, over: 'refuse', accept: 'image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8' });
      if (!r.type.startsWith('image/') || r.type.includes('svg')) return null;
      const out = await draw(sharp(r.body, { limitInputPixels: 40_000_000, animated: false, failOn: 'error' }).rotate()).toBuffer();
      return `data:${mime};base64,${out.toString('base64')}`;
    } catch {
      return null;
    }
  }
}

const short = (s: string | undefined | null, max: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const c = [...t];
  return c.length > max ? `${c.slice(0, max - 1).join('')}…` : t;
};
