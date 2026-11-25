import { describe, expect, it } from 'vitest';
import {
  backendOf,
  bunnyConfigFrom,
  cacheControlFor,
  encodeKey,
  mediaKey,
  r2Backend,
  r2ConfigFrom,
  r2CopyObject,
  r2HeadObject,
  r2PutObject,
  r2Url,
  rewriteUrl,
  signV4,
  urlPrefixes,
  writeBackend,
  bunnyBackend,
  type R2Config,
} from './index';

describe('SigV4', () => {
  it('matches the AWS S3 documentation example (GET with Range)', () => {
    const h = signV4({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      headers: { range: 'bytes=0-9' },
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(h.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
    expect(h['x-amz-date']).toBe('20130524T000000Z');
    expect(h.host).toBeUndefined();
  });
  it('encodes keys segment by segment', () => {
    expect(encodeKey("a b/c'd/e.mp4")).toBe('a%20b/c%27d/e.mp4');
    const k = mediaKey('video', 'u-1', 'video/mp4', 'x');
    expect(encodeKey(k)).toBe(k);
  });
});

/** a fetch that records what was asked and answers from a little bucket */
function fakeR2() {
  const objects = new Map<string, { body: Uint8Array; type: string; cache: string }>();
  const calls: { method: string; url: string; headers: Record<string, string> }[] = [];
  const f = (async (url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array }) => {
    calls.push({ method: init.method, url, headers: init.headers });
    const key = new URL(url).pathname.replace(/^\/obolo-media\//, '');
    if (init.method === 'PUT' && init.headers['x-amz-copy-source']) {
      const from = objects.get(init.headers['x-amz-copy-source'].replace(/^\/obolo-media\//, ''));
      if (!from) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
      objects.set(key, { ...from });
      return new Response('<CopyObjectResult/>', { status: 200 });
    }
    if (init.method === 'PUT') {
      objects.set(key, { body: init.body!, type: init.headers['content-type'], cache: init.headers['cache-control'] });
      return new Response(null, { status: 200 });
    }
    const o = objects.get(key);
    if (init.method === 'HEAD') return o ? new Response(null, { status: 200, headers: { 'content-length': String(o.body.length), 'content-type': o.type } }) : new Response(null, { status: 404 });
    if (init.method === 'DELETE') return objects.delete(key), new Response(null, { status: 204 });
    return o ? new Response(o.body, { status: 200 }) : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const cfg: R2Config = { accountId: 'acc', bucket: 'obolo-media', accessKeyId: 'AK', secretAccessKey: 'SK', publicBase: 'https://media.obolo.life', fetch: f };
  return { cfg, objects, calls };
}

describe('R2 objects', () => {
  it('puts with the type, an immutable Cache-Control and a signature; the URL is on the public domain', async () => {
    const { cfg, objects, calls } = fakeR2();
    const key = mediaKey('video', 'user-1', 'video/mp4', 'v1');
    const url = await r2PutObject(cfg, key, new Uint8Array([1, 2, 3]), 'video/mp4');
    expect(url).toBe(`https://media.obolo.life/${key}`);
    expect(calls[0].url).toBe(`https://acc.r2.cloudflarestorage.com/obolo-media/${key}`);
    expect(calls[0].headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=cache-control;content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(objects.get(key)).toMatchObject({ type: 'video/mp4', cache: 'public, max-age=31536000, immutable' });
    expect(await r2HeadObject(cfg, key)).toEqual({ size: 3, contentType: 'video/mp4' });
    expect(await r2HeadObject(cfg, 'nope')).toBeNull();
  });
  it('copies inside the bucket and deletes (a missing object is fine)', async () => {
    const { cfg, objects } = fakeR2();
    await r2PutObject(cfg, 'image/aa/u/a.webp', new Uint8Array([9]), 'image/webp');
    expect(await r2CopyObject(cfg, 'image/aa/u/a.webp', 'image/aa/u/b.webp')).toBe('https://media.obolo.life/image/aa/u/b.webp');
    expect(objects.get('image/aa/u/b.webp')?.type).toBe('image/webp');
    await expect(r2CopyObject(cfg, 'missing', 'x')).rejects.toThrow(/R2 copy failed/);
    const b = r2Backend(cfg);
    await b.delete('image/aa/u/a.webp');
    await b.delete('image/aa/u/a.webp');
    expect(objects.has('image/aa/u/a.webp')).toBe(false);
  });
  it('Cache-Control by key', () => {
    expect(cacheControlFor('tmp/clip/x/0')).toBe('no-store');
    expect(cacheControlFor('file/ab/u/x.pdf')).toMatch(/^private/);
    expect(cacheControlFor('photo/ab/u/x.webp')).toBe('public, max-age=31536000, immutable');
  });
});

describe('which backend', () => {
  const r2 = r2ConfigFrom({ accountId: 'a', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's', publicBase: 'https://media.obolo.life/' });
  const bunny = bunnyConfigFrom({ zone: 'z', accessKey: 'k', cdnHost: 'obolo.b-cdn.net' });
  it('R2 only when every setting is there', () => {
    expect(r2?.publicBase).toBe('https://media.obolo.life');
    expect(r2ConfigFrom({ accountId: 'a', bucket: 'b', accessKeyId: 'k', publicBase: 'https://m' })).toBeNull();
    expect(r2ConfigFrom({ accountId: 'a', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's', publicBase: 'media.obolo.life' })).toBeNull();
    expect(bunnyConfigFrom({ zone: 'z', accessKey: 'k' })).toBeNull();
  });
  it('new files: R2, else Bunny, else none (Postgres in dev)', () => {
    const R = r2Backend(r2!);
    const B = bunnyBackend(bunny!);
    expect(writeBackend({ r2: R, bunny: B })?.name).toBe('r2');
    expect(writeBackend({ r2: null, bunny: B })?.name).toBe('bunny');
    expect(writeBackend({ r2: null, bunny: null })).toBeNull();
    expect(backendOf({ r2: R, bunny: B }, 'bunny')).toBe(B);
    expect(backendOf({ r2: R, bunny: B }, 'r2')).toBe(R);
    expect(backendOf({ r2: R, bunny: B }, 'db')).toBeNull();
    expect(backendOf({ r2: null, bunny: B }, 'r2')).toBeNull();
  });
  it('URLs: the same key on both, so an old URL is rewritten by its prefix', () => {
    const key = mediaKey('voice', 'user-1', 'audio/webm', 'abc');
    const p = urlPrefixes(bunny!, r2!);
    expect(p).toEqual({ from: 'https://obolo.b-cdn.net/', to: 'https://media.obolo.life/' });
    expect(rewriteUrl(bunnyBackend(bunny!).url(key), p)).toBe(r2Url(r2!, key));
    expect(rewriteUrl(JSON.stringify({ a: `https://obolo.b-cdn.net/${key}`, b: 'https://other.example/x' }), p)).toBe(
      JSON.stringify({ a: `https://media.obolo.life/${key}`, b: 'https://other.example/x' }),
    );
  });
});
