import { z } from 'zod';

/**
 * R12 (client 2026-11-25): a URL pasted into the Bati chat or a ダチ talk is not shown as a plain link — the words around
 * it stay in the bubble, the URL itself becomes a small floating "portal" (its preview through POST /links/unfurl).
 * The pure parts live here: finding the URLs in a message, splitting it, what kind of place a link leads to.
 */

/** at most this many portals for one message (more URLs stay as words) */
export const LINK_MAX_PER_MESSAGE = 3;
/** a URL longer than this is left as words */
export const LINK_MAX_LENGTH = 2000;

export type TextPart = { t: 'text'; s: string } | { t: 'url'; url: string };

// a URL: http(s):// or www., then anything up to a space / a full-width space / a Japanese bracket or quote
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s　<>"'「」『』【】（）〈〉《》、。，！？]+/gi;
// characters a sentence puts after a URL that are not part of it
const TRAIL = /[.,:;!?…・〜~*_]+$/;

/** where the URLs in a text are (http / https only; `www.` gets https), the sentence's own punctuation left out */
export function findUrls(text: string): { url: string; start: number; end: number }[] {
  const out: { url: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    const start = m.index ?? 0;
    // a closing bracket belongs to the URL only when the URL opened one: (https://x.com/a_(b)) keeps "(b)"
    for (;;) {
      const trimmed = raw.replace(TRAIL, '');
      const close = trimmed.match(/[)\]}]$/);
      if (close) {
        const open = { ')': '(', ']': '[', '}': '{' }[close[0]]!;
        const opens = trimmed.split(open).length - 1;
        const closes = trimmed.split(close[0]).length - 1;
        if (closes > opens) {
          raw = trimmed.slice(0, -1);
          continue;
        }
      }
      raw = trimmed;
      break;
    }
    const url = /^www\./i.test(raw) ? `https://${raw}` : raw;
    if (raw.length < 8 || url.length > LINK_MAX_LENGTH || !isWebUrl(url)) continue;
    out.push({ url, start, end: start + raw.length });
  }
  return out;
}

/** a real http(s) URL with a host that has a dot (or is an IP) — not `http://foo` */
export function isWebUrl(s: string): boolean {
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    return /\./.test(u.hostname) || /^\[.*\]$/.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * a message as its words and its URLs, in order (at most `max` URLs become portals; the rest stay words). The words
 * are trimmed at the edges next to a URL and empty runs dropped.
 */
export function splitUrls(text: string, max = LINK_MAX_PER_MESSAGE): TextPart[] {
  const found = findUrls(text).slice(0, max);
  if (!found.length) return text ? [{ t: 'text', s: text }] : [];
  const parts: TextPart[] = [];
  let at = 0;
  for (const f of found) {
    const s = text.slice(at, f.start).trim();
    if (s) parts.push({ t: 'text', s });
    parts.push({ t: 'url', url: f.url });
    at = f.end;
  }
  const rest = text.slice(at).trim();
  if (rest) parts.push({ t: 'text', s: rest });
  return parts;
}

/** the words of a message with its portal URLs taken out (joined by a line break), and the URLs */
export function wordsAndLinks(text: string, max = LINK_MAX_PER_MESSAGE): { words: string; urls: string[] } {
  const parts = splitUrls(text, max);
  return {
    words: parts
      .filter((p): p is { t: 'text'; s: string } => p.t === 'text')
      .map((p) => p.s)
      .join('\n'),
    urls: [...new Set(parts.filter((p): p is { t: 'url'; url: string } => p.t === 'url').map((p) => p.url))],
  };
}

export const LINK_KINDS = ['youtube', 'spotify', 'soundcloud', 'web'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  } catch {
    return '';
  }
};

/** the YouTube video id of a link (watch, youtu.be, shorts, embed, live), or null */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = hostOf(url);
  const ok = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null);
  if (h === 'youtu.be') return ok(u.pathname.split('/')[1]);
  if (h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return ok(u.searchParams.get('v'));
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    return ok(m?.[1]);
  }
  return null;
}

/** what kind of place a link leads to (a few get their own look) */
export function linkKind(url: string): LinkKind {
  const h = hostOf(url);
  if (youtubeId(url)) return 'youtube';
  if (h === 'open.spotify.com' || h === 'spotify.link') return 'spotify';
  if (h === 'soundcloud.com' || h === 'on.soundcloud.com') return 'soundcloud';
  return 'web';
}

/** the domain shown small under a portal (no www.) */
export const linkDomain = (url: string) => hostOf(url) || url.slice(0, 40);

export const UnfurlBody = z.object({ url: z.string().trim().min(8).max(LINK_MAX_LENGTH) });
export type UnfurlBody = z.infer<typeof UnfurlBody>;

/** a link's preview (POST /links/unfurl). Pictures come as small data: URLs (re-encoded on the server), never a remote link */
export interface LinkPreview {
  /** the URL as pasted */
  url: string;
  /** where it ended up after redirects */
  finalUrl: string;
  kind: LinkKind;
  title: string | null;
  siteName: string | null;
  description: string | null;
  /** data:image/webp;base64,… (≤ 480 px), or null */
  image: string | null;
  /** data:image/png;base64,… (64 px), or null */
  favicon: string | null;
  /** false: the page could not be read (the portal shows just the domain) */
  ok: boolean;
}

/** the bare preview of a link that could not be read */
export function barePreview(url: string): LinkPreview {
  return { url, finalUrl: url, kind: linkKind(url), title: null, siteName: null, description: null, image: null, favicon: null, ok: false };
}
