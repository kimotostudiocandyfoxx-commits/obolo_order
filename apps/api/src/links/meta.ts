/**
 * R12: what a page says about itself — Open Graph / Twitter card / <title> / icons — read from the start of its HTML
 * with plain patterns (no DOM, nothing run). Every value is decoded, squeezed to one line and cut short; links are made
 * absolute against the page (http / https only).
 */
export type PageMeta = { title: string | null; siteName: string | null; description: string | null; image: string | null; icons: string[] };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n < 0xe000) ? String.fromCodePoint(n) : '';
    }
    return ENT[e.toLowerCase()] ?? all;
  });
}

// eslint-disable-next-line no-control-regex
const clean = (s: string | undefined | null, max: number) => {
  if (!s) return null;
  const t = decodeEntities(s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  const chars = [...t];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : t;
};

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

const abs = (href: string | undefined, base: string): string | null => {
  if (!href) return null;
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

/** the charset a page declares in its own <meta> (used when the response header named none) */
export function metaCharset(head: string): string | null {
  return /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase() ?? null;
}

export function parseMeta(html: string, base: string): PageMeta {
  // only the head matters (and only what came: a cut page has no </head>)
  const end = html.search(/<\/head\s*>|<body[\s>]/i);
  const head = (end > 0 ? html.slice(0, end) : html).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  const meta = new Map<string, string>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    if (key && a.content != null && !meta.has(key)) meta.set(key, a.content);
  }
  const icons: { href: string; rank: number }[] = [];
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/);
    const href = abs(a.href, base);
    if (!href) continue;
    // a PNG first (an .ico or an SVG is not drawn)
    if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) icons.push({ href, rank: 0 });
    else if (rel.includes('icon')) icons.push({ href, rank: /\.png(\?|$)/i.test(href) || /png/i.test(a.type ?? '') ? 1 : /\.ico(\?|$)/i.test(href) || /svg/i.test(a.type ?? '') || /\.svg(\?|$)/i.test(href) ? 3 : 2 });
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];
  return {
    title: clean(meta.get('og:title') ?? meta.get('twitter:title') ?? title, 120),
    siteName: clean(meta.get('og:site_name') ?? meta.get('application-name') ?? meta.get('twitter:site')?.replace(/^@/, ''), 60),
    description: clean(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'), 200),
    image: abs(meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image') ?? meta.get('twitter:image:src'), base),
    icons: icons.sort((a, b) => a.rank - b.rank).map((i) => i.href).slice(0, 3),
  };
}

/** a page's bytes as text: the header's charset, else the page's own, else UTF-8 (Shift_JIS / EUC-JP pages read right) */
export function decodeHtml(body: Buffer, headerCharset: string | null): string {
  const sniff = body.subarray(0, 4096).toString('latin1');
  const cs = headerCharset ?? metaCharset(sniff) ?? 'utf-8';
  try {
    return new TextDecoder(cs, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(body);
  }
}
