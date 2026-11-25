import { lookup as dnsLookup } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import zlib from 'node:zlib';

/**
 * R12: the safe fetch behind POST /links/unfurl — the server reads a page a member pasted, so it must never be turned
 * against our own network (SSRF):
 *  - http / https only, ports 80 / 443 only, no user:password in the URL;
 *  - every address a host name resolves to is checked, at connect time (the socket's own `lookup`, so a DNS answer cannot
 *    change between the check and the connection), and an IP literal before it; private, loopback, link-local, CGNAT,
 *    multicast, documentation, IPv4-mapped / NAT64 / 6to4 / Teredo forms of them … are refused;
 *  - redirects are followed by hand (at most `maxRedirects`), each hop checked the same way;
 *  - one deadline for the whole chain; the body (after gunzip) is cut at `maxBytes` (a page: the start is kept; a
 *    picture: refused); no cookies are ever sent or kept.
 */
export class FetchRefused extends Error {
  constructor(
    readonly code: 'SCHEME' | 'PORT' | 'CREDENTIALS' | 'BAD_URL' | 'PRIVATE_ADDRESS' | 'TOO_MANY_REDIRECTS' | 'TOO_LARGE' | 'TIMEOUT' | 'HTTP_STATUS' | 'NETWORK',
    message: string,
  ) {
    super(message);
  }
}

// ---- addresses ----

function v4Bytes(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const b = m.slice(1).map(Number);
  return b.every((x) => x <= 255) ? b : null;
}

function v6Bytes(ip: string): number[] | null {
  let s = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (isIP(s) !== 6) return null;
  // a dotted IPv4 tail (::ffff:1.2.3.4) → two hex groups
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const b = v4Bytes(tail[1]);
    if (!b) return null;
    s = s.slice(0, -tail[1].length) + `${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`;
  }
  const [head, rest] = s.split('::');
  const hs = head ? head.split(':') : [];
  const rs = rest !== undefined && rest !== '' ? rest.split(':') : [];
  const groups = rest === undefined ? hs : [...hs, ...Array(8 - hs.length - rs.length).fill('0'), ...rs];
  if (groups.length !== 8) return null;
  return groups.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 255];
  });
}

const inV4 = (b: number[], base: number[], bits: number) => {
  for (let i = 0; i < 4; i++) {
    const keep = Math.max(0, Math.min(8, bits - i * 8));
    const mask = keep === 0 ? 0 : (0xff << (8 - keep)) & 0xff;
    if ((b[i] & mask) !== (base[i] & mask)) return false;
  }
  return true;
};
/** IPv4 ranges that are not the public internet (RFC 6890 and friends) */
const V4_BLOCKED: [number[], number][] = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 88, 99, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
  [[240, 0, 0, 0], 4],
];

const inV6 = (b: number[], prefix: number[], bits: number) => {
  for (let i = 0; i < 16; i++) {
    const keep = Math.max(0, Math.min(8, bits - i * 8));
    if (!keep) return true;
    const mask = (0xff << (8 - keep)) & 0xff;
    if ((b[i] & mask) !== ((prefix[i] ?? 0) & mask)) return false;
  }
  return true;
};
/** inside 2000::/3 (global unicast) but still not the open internet */
const V6_BLOCKED: [number[], number][] = [
  [[0x20, 0x01, 0x00, 0x00], 23], // IETF protocol assignments (Teredo 2001::/32, ORCHID …)
  [[0x20, 0x01, 0x0d, 0xb8], 32], // documentation
  [[0x20, 0x02], 16], // 6to4 (wraps any IPv4)
  [[0x3f, 0xff, 0xf0, 0x00], 20], // documentation (RFC 9637)
];

/** true only for an address on the public internet (an IPv4-mapped / NAT64 IPv6 is judged by its IPv4) */
export function isPublicIp(ip: string): boolean {
  const v4 = v4Bytes(ip);
  if (v4) return !V4_BLOCKED.some(([base, bits]) => inV4(v4, base, bits));
  const b = v6Bytes(ip);
  if (!b) return false;
  const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  // ::ffff:a.b.c.d (mapped) and 64:ff9b::a.b.c.d (NAT64): the IPv4 inside decides
  if (zero(0, 10) && b[10] === 0xff && b[11] === 0xff) return isPublicIp(b.slice(12).join('.'));
  if (inV6(b, [0x00, 0x64, 0xff, 0x9b], 96) || inV6(b, [0x00, 0x64, 0xff, 0x9b, 0, 1], 48)) return isPublicIp(b.slice(12).join('.'));
  // only global unicast 2000::/3 (this leaves out ::, ::1, fc00::/7, fe80::/10, ff00::/8, 100::/64 …)
  if ((b[0] & 0xe0) !== 0x20) return false;
  return !V6_BLOCKED.some(([p, bits]) => inV6(b, p, bits));
}

// ---- URLs ----

/** the URL, if it may be fetched at all (scheme, port, no credentials); throws FetchRefused */
export function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new FetchRefused('BAD_URL', 'Not a URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new FetchRefused('SCHEME', `Scheme ${u.protocol} not allowed`);
  if (u.username || u.password) throw new FetchRefused('CREDENTIALS', 'Credentials in URL not allowed');
  if (u.port && u.port !== '80' && u.port !== '443') throw new FetchRefused('PORT', `Port ${u.port} not allowed`);
  if (!u.hostname) throw new FetchRefused('BAD_URL', 'No host');
  u.hash = '';
  return u;
}

// ---- fetching ----

export type LookupAll = (host: string) => Promise<{ address: string; family: number }[]>;
const systemLookup: LookupAll = (host) =>
  new Promise((resolve, reject) => dnsLookup(host, { all: true, verbatim: true }, (err, addrs) => (err ? reject(err) : resolve(addrs))));

export type SafeFetchOptions = {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
  /** what happens past maxBytes: 'cut' keeps the start (a page's <head>), 'refuse' throws TOO_LARGE (a picture) */
  over: 'cut' | 'refuse';
  accept?: string;
  /** tests: the resolver and the address rule (default: the system's DNS, isPublicIp) */
  lookup?: LookupAll;
  allowIp?: (ip: string) => boolean;
};

export type Fetched = { url: string; status: number; type: string; charset: string | null; body: Buffer; cut: boolean };

const UA = 'Mozilla/5.0 (compatible; OboloLinkPreview/1.0; +https://obolo.app)';

/** GET a URL under the rules above; resolves with the last hop's body (2xx only) */
export async function safeFetch(raw: string, o: SafeFetchOptions): Promise<Fetched> {
  const allow = o.allowIp ?? isPublicIp;
  const resolveAll = o.lookup ?? systemLookup;
  const deadline = Date.now() + o.timeoutMs;
  let url = checkUrl(raw);
  for (let hop = 0; ; hop++) {
    const r = await oneHop(url, o, allow, resolveAll, deadline);
    if ('location' in r) {
      if (hop >= o.maxRedirects) throw new FetchRefused('TOO_MANY_REDIRECTS', 'Too many redirects');
      url = checkUrl(new URL(r.location, url).toString());
      continue;
    }
    return r;
  }
}

function oneHop(url: URL, o: SafeFetchOptions, allow: (ip: string) => boolean, resolveAll: LookupAll, deadline: number): Promise<Fetched | { location: string }> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    // an IP literal never goes through `lookup`: checked here
    if (isIP(host) && !allow(host)) return reject(new FetchRefused('PRIVATE_ADDRESS', 'Address not allowed'));
    const left = deadline - Date.now();
    if (left <= 0) return reject(new FetchRefused('TIMEOUT', 'Timed out'));
    // the socket's own resolver: every address checked, the connection made to a checked one (no DNS rebinding gap)
    const lookup: LookupFunction = (hostname, options, cb) => {
      resolveAll(hostname).then(
        (addrs) => {
          if (!addrs.length) return cb(new FetchRefused('NETWORK', 'No address'), '', 0);
          if (addrs.some((a) => !allow(a.address))) return cb(new FetchRefused('PRIVATE_ADDRESS', 'Address not allowed'), '', 0);
          if ((options as { all?: boolean }).all) return (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, addrs);
          cb(null, addrs[0].address, addrs[0].family);
        },
        (e: Error) => cb(e as NodeJS.ErrnoException, '', 0),
      );
    };
    const mod = url.protocol === 'https:' ? https : http;
    let done = false;
    const fail = (e: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      req.destroy();
      reject(e instanceof FetchRefused ? e : new FetchRefused('NETWORK', e.message));
    };
    const req = mod.request(
      url,
      {
        method: 'GET',
        lookup,
        agent: false,
        headers: { 'user-agent': UA, accept: o.accept ?? '*/*', 'accept-language': 'ja,en;q=0.8', 'accept-encoding': 'gzip, deflate, br' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          done = true;
          clearTimeout(timer);
          res.resume();
          req.destroy();
          return resolve({ location: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return fail(new FetchRefused('HTTP_STATUS', `HTTP ${status}`));
        }
        const len = Number(res.headers['content-length'] ?? 0);
        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        if (o.over === 'refuse' && !enc && len > o.maxBytes) return fail(new FetchRefused('TOO_LARGE', 'Too large'));
        const ctype = String(res.headers['content-type'] ?? '');
        const type = ctype.split(';')[0].trim().toLowerCase();
        const charset = /charset=["']?([\w-]+)/i.exec(ctype)?.[1]?.toLowerCase() ?? null;
        // (a zip bomb is cut by the decompressed byte count)
        const stream = enc === 'gzip' || enc === 'x-gzip' ? res.pipe(zlib.createGunzip()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let n = 0;
        const finish = (cut: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          req.destroy();
          resolve({ url: url.toString(), status, type, charset, body: Buffer.concat(chunks).subarray(0, o.maxBytes), cut });
        };
        stream.on('data', (c: Buffer) => {
          if (done) return;
          n += c.length;
          chunks.push(c);
          if (n > o.maxBytes) {
            if (o.over === 'refuse') return fail(new FetchRefused('TOO_LARGE', 'Too large'));
            finish(true);
          }
        });
        stream.on('end', () => finish(false));
        stream.on('error', (e: Error) => fail(e));
        res.on('error', (e: Error) => fail(e));
      },
    );
    const timer = setTimeout(() => fail(new FetchRefused('TIMEOUT', 'Timed out')), left);
    req.on('error', (e: Error) => fail(e));
    req.end();
  });
}
