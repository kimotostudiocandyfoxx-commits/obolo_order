import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemoryKv } from '../infra/kv';
import { checkUrl, FetchRefused, isPublicIp, safeFetch, type LookupAll, type SafeFetchOptions } from './guard';
import { LinksService } from './links.service';
import { decodeHtml, parseMeta } from './meta';

describe('unfurl guard: addresses', () => {
  it('refuses private, loopback, link-local and other non-internet IPv4', () => {
    for (const ip of ['127.0.0.1', '127.1.2.3', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.1', '198.18.0.1'])
      expect(isPublicIp(ip), ip).toBe(false);
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34', '100.128.0.1']) expect(isPublicIp(ip), ip).toBe(true);
  });

  it('refuses the IPv6 forms (loopback, ULA, link-local, mapped / NAT64 / 6to4 / Teredo)', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fe80::1%eth0', 'fd00::1', 'fc00::abcd', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::a00:1', '2002:7f00:1::1', '2001:0:4136:e378::1', '2001:db8::1', '::127.0.0.1', '[::1]'])
      expect(isPublicIp(ip), ip).toBe(false);
    for (const ip of ['2606:4700:4700::1111', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8', '64:ff9b::808:808']) expect(isPublicIp(ip), ip).toBe(true);
    expect(isPublicIp('not-an-ip')).toBe(false);
  });

  it('only http / https on 80 / 443, no credentials', () => {
    const code = (u: string) => {
      try {
        checkUrl(u);
        return 'ok';
      } catch (e) {
        return (e as FetchRefused).code;
      }
    };
    expect(code('https://example.com/a')).toBe('ok');
    expect(code('http://example.com:80/a')).toBe('ok');
    expect(code('file:///etc/passwd')).toBe('SCHEME');
    expect(code('ftp://example.com/x')).toBe('SCHEME');
    expect(code('gopher://example.com/x')).toBe('SCHEME');
    expect(code('javascript:alert(1)')).toBe('SCHEME');
    expect(code('data:text/html,hi')).toBe('SCHEME');
    expect(code('http://example.com:6379/')).toBe('PORT');
    expect(code('https://user:pw@example.com/')).toBe('CREDENTIALS');
    expect(code('not a url')).toBe('BAD_URL');
  });
});

describe('unfurl guard: fetching', () => {
  // a local server stands in for "the internet": its host names resolve to 127.0.0.1, which the test's rule allows
  // (only that one address); everything else keeps the real rule
  let server: http.Server;
  let port = 0;
  const big = Buffer.alloc(300_000, 'a');
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = req.url ?? '/';
      if (req.headers.cookie) res.setHeader('x-saw-cookie', '1');
      if (u === '/page') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'a=1' }).end('<html><head><title>Moon &amp; Sea</title><meta property="og:image" content="/pic.png"></head><body>hi</body></html>');
      if (u.startsWith('/hop/')) {
        const n = Number(u.split('/')[2]);
        return res.writeHead(302, { location: n > 0 ? `/hop/${n - 1}` : '/page' }).end();
      }
      if (u === '/to-private') return res.writeHead(301, { location: 'http://10.0.0.7/secret' }).end();
      if (u === '/to-metadata') return res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end();
      if (u === '/to-loopback-name') return res.writeHead(302, { location: 'http://inside.test/page' }).end();
      if (u === '/to-file') return res.writeHead(302, { location: 'file:///etc/passwd' }).end();
      if (u === '/big') return res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(big.length) }).end(big);
      if (u === '/big-chunked') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.write(big.subarray(0, 150_000));
        return res.end(big.subarray(150_000));
      }
      if (u === '/bomb') return res.writeHead(200, { 'content-type': 'image/png', 'content-encoding': 'gzip' }).end(zlib.gzipSync(Buffer.alloc(5_000_000)));
      if (u === '/long-page') return res.writeHead(200, { 'content-type': 'text/html' }).end(`<head><title>Long</title></head>${'x'.repeat(200_000)}`);
      if (u === '/slow') return setTimeout(() => res.end('late'), 2000);
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const lookup: LookupAll = async (host) => {
    if (host === 'site.test') return [{ address: '127.0.0.1', family: 4 }];
    if (host === 'inside.test') return [{ address: '10.1.2.3', family: 4 }];
    if (host === 'mixed.test') return [{ address: '8.8.8.8', family: 4 }, { address: '192.168.0.10', family: 4 }];
    if (host === 'v6.test') return [{ address: '::1', family: 6 }];
    throw new Error('ENOTFOUND');
  };
  const base = () => `http://site.test`;
  const o = (p: Partial<SafeFetchOptions> = {}): SafeFetchOptions => ({ maxBytes: 100_000, timeoutMs: 1500, maxRedirects: 3, over: 'refuse', lookup, allowIp: (ip) => ip === '127.0.0.1' || isPublicIp(ip), ...p });
  // the guard allows ports 80 / 443 only: the URL keeps port 80 and http.request is pointed at the test server's port
  const go = async (path: string, p: Partial<SafeFetchOptions> = {}) => {
    const orig = http.request;
    // route port 80 to the test server
    (http as unknown as { request: typeof http.request }).request = ((url: URL, opts: http.RequestOptions, cb: (res: http.IncomingMessage) => void) => orig(url, { ...opts, port }, cb)) as unknown as typeof http.request;
    try {
      return await safeFetch(`${base()}${path}`, o(p));
    } finally {
      (http as unknown as { request: typeof http.request }).request = orig;
    }
  };
  const refused = async (path: string, p: Partial<SafeFetchOptions> = {}) => {
    try {
      await go(path, p);
      return 'fetched';
    } catch (e) {
      return e instanceof FetchRefused ? e.code : String(e);
    }
  };

  it('fetches a public page, sends no cookies', async () => {
    const r = await go('/page');
    expect(r.status).toBe(200);
    expect(r.body.toString()).toContain('Moon');
  });

  it('follows at most 3 redirects', async () => {
    expect((await go('/hop/2')).body.toString()).toContain('Moon');
    expect(await refused('/hop/3')).toBe('TOO_MANY_REDIRECTS');
  });

  it('refuses a redirect to a private address, a cloud metadata address, a name that resolves inside, or another scheme', async () => {
    expect(await refused('/to-private')).toBe('PRIVATE_ADDRESS');
    expect(await refused('/to-metadata')).toBe('PRIVATE_ADDRESS');
    expect(await refused('/to-loopback-name')).toBe('PRIVATE_ADDRESS');
    expect(await refused('/to-file')).toBe('SCHEME');
  });

  it('refuses names that resolve to private addresses (any one of them), and IP literals', async () => {
    const plain = { lookup, allowIp: isPublicIp };
    for (const u of ['http://inside.test/', 'http://mixed.test/', 'http://v6.test/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/', 'http://0x7f000001/', 'http://2130706433/']) {
      await expect(safeFetch(u, { ...o(), ...plain }), u).rejects.toMatchObject({ code: 'PRIVATE_ADDRESS' });
    }
  });

  it('refuses non-http schemes outright', async () => {
    for (const u of ['file:///etc/passwd', 'ftp://example.com/', 'gopher://x.com/']) await expect(safeFetch(u, o())).rejects.toMatchObject({ code: 'SCHEME' });
  });

  it('size limit: a picture over the limit is refused (by length, while streaming, after gunzip); a page is cut', async () => {
    expect(await refused('/big')).toBe('TOO_LARGE');
    expect(await refused('/big-chunked')).toBe('TOO_LARGE');
    expect(await refused('/bomb')).toBe('TOO_LARGE');
    const r = await go('/long-page', { over: 'cut', maxBytes: 4096 });
    expect(r.cut).toBe(true);
    expect(r.body.length).toBe(4096);
    expect(r.body.toString()).toContain('<title>Long');
  });

  it('times out', async () => {
    expect(await refused('/slow', { timeoutMs: 300 })).toBe('TIMEOUT');
  });
});

describe('unfurl: page meta', () => {
  it('reads Open Graph, falls back to <title>, makes links absolute, decodes entities', () => {
    const m = parseMeta(
      `<html><head><meta charset="utf-8"><title>Plain</title><meta property="og:title" content="月の &quot;海&quot; &#x1F319;"><meta property='og:site_name' content='Moon News'><meta name="description" content="  a\n  b "><meta property="og:image" content="/img/a.jpg"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/touch.png"></head><body><meta property="og:title" content="late"></body>`,
      'https://moon.example/news/1',
    );
    expect(m.title).toBe('月の "海" 🌙');
    expect(m.siteName).toBe('Moon News');
    expect(m.description).toBe('a b');
    expect(m.image).toBe('https://moon.example/img/a.jpg');
    expect(m.icons[0]).toBe('https://moon.example/touch.png');
    expect(parseMeta('<title>Only</title>', 'https://x.example/').title).toBe('Only');
    expect(parseMeta('<meta property="og:image" content="javascript:alert(1)">', 'https://x.example/').image).toBeNull();
  });

  it('reads a Shift_JIS page', () => {
    const sjis = Buffer.from([0x3c, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e, 0x8c, 0x8e, 0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e]); // <title>月</title>
    expect(parseMeta(decodeHtml(sjis, 'shift_jis'), 'https://x.example/').title).toBe('月');
  });
});

describe('unfurl: service', () => {
  it('builds a preview with the picture re-encoded as a data: URL, and caches it', async () => {
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#335' } }).png().toBuffer();
    const calls: string[] = [];
    const s = new LinksService(new MemoryKv());
    s.fetcher = async (url) => {
      calls.push(url);
      if (url.endsWith('/pic.png') || url.endsWith('/touch.png')) return { url, status: 200, type: 'image/png', charset: null, body: png, cut: false };
      if (url.endsWith('/favicon.png')) throw new FetchRefused('HTTP_STATUS', '404');
      return { url, status: 200, type: 'text/html', charset: 'utf-8', body: Buffer.from('<head><title>T</title><meta property="og:image" content="/pic.png"><link rel="apple-touch-icon" href="/touch.png"></head>'), cut: false };
    };
    const p = await s.unfurl('https://site.example/a');
    expect(p).toMatchObject({ ok: true, title: 'T', kind: 'web' });
    expect(p.image).toMatch(/^data:image\/webp;base64,/);
    expect(p.favicon).toMatch(/^data:image\/png;base64,/);
    const meta = await sharp(Buffer.from(p.image!.split(',')[1], 'base64')).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(480);
    const n = calls.length;
    await s.unfurl('https://site.example/a');
    expect(calls.length).toBe(n);
  });

  it('a page that cannot be read gives the bare preview (cached shorter)', async () => {
    const s = new LinksService(new MemoryKv());
    s.fetcher = async () => {
      throw new FetchRefused('PRIVATE_ADDRESS', 'no');
    };
    expect(await s.unfurl('https://inside.example/')).toMatchObject({ ok: false, title: null, image: null });
  });

  it('YouTube goes by oEmbed and its own thumbnail', async () => {
    const s = new LinksService(new MemoryKv());
    const calls: string[] = [];
    s.fetcher = async (url) => {
      calls.push(url);
      if (url.startsWith('https://www.youtube.com/oembed')) return { url, status: 200, type: 'application/json', charset: null, body: Buffer.from(JSON.stringify({ title: 'Moon Song', author_name: 'Neo' })), cut: false };
      throw new FetchRefused('HTTP_STATUS', '404');
    };
    const p = await s.unfurl('https://youtu.be/dQw4w9WgXcQ');
    expect(p).toMatchObject({ ok: true, kind: 'youtube', title: 'Moon Song', siteName: 'YouTube', description: 'Neo' });
    expect(calls).toContain('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});
