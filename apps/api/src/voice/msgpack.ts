/**
 * Minimal MessagePack encoder — Fish Audio takes /v1/tts as msgpack when reference audio bytes are
 * sent (the official SDK does the same). Covers what a TTS request holds: null, booleans, numbers,
 * strings, bytes, arrays and plain objects (undefined fields are skipped).
 */
type Packable = null | undefined | boolean | number | string | Uint8Array | Packable[] | { [k: string]: Packable };

export function packMsg(v: Packable): Buffer {
  const out: Buffer[] = [];
  const head = (small: number, codes: [number, number, number], n: number, smallMax: number) => {
    if (n <= smallMax && small >= 0) out.push(Buffer.from([small | n]));
    else if (n < 0x100 && codes[0] >= 0) out.push(Buffer.from([codes[0], n]));
    else if (n < 0x10000) {
      const b = Buffer.alloc(3);
      b[0] = codes[1];
      b.writeUInt16BE(n, 1);
      out.push(b);
    } else {
      const b = Buffer.alloc(5);
      b[0] = codes[2];
      b.writeUInt32BE(n, 1);
      out.push(b);
    }
  };
  const enc = (x: Packable): void => {
    if (x === null || x === undefined) out.push(Buffer.from([0xc0]));
    else if (typeof x === 'boolean') out.push(Buffer.from([x ? 0xc3 : 0xc2]));
    else if (typeof x === 'number') {
      if (Number.isInteger(x) && x >= 0 && x < 0x80) out.push(Buffer.from([x]));
      else if (Number.isInteger(x) && x < 0 && x >= -32) out.push(Buffer.from([x & 0xff]));
      else if (Number.isInteger(x) && x >= 0 && x <= 0xffffffff) {
        const b = Buffer.alloc(5);
        b[0] = 0xce;
        b.writeUInt32BE(x, 1);
        out.push(b);
      } else {
        const b = Buffer.alloc(9);
        b[0] = 0xcb;
        b.writeDoubleBE(x, 1);
        out.push(b);
      }
    } else if (typeof x === 'string') {
      const s = Buffer.from(x, 'utf8');
      head(0xa0, [0xd9, 0xda, 0xdb], s.length, 31);
      out.push(s);
    } else if (x instanceof Uint8Array) {
      head(-1, [0xc4, 0xc5, 0xc6], x.length, -1);
      out.push(Buffer.from(x));
    } else if (Array.isArray(x)) {
      head(0x90, [-1, 0xdc, 0xdd], x.length, 15);
      x.forEach(enc);
    } else {
      const entries = Object.entries(x).filter(([, val]) => val !== undefined);
      head(0x80, [-1, 0xde, 0xdf], entries.length, 15);
      for (const [k, val] of entries) {
        enc(k);
        enc(val);
      }
    }
  };
  enc(v);
  return Buffer.concat(out);
}
