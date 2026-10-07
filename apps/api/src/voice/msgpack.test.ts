import { describe, expect, it } from 'vitest';
import { packMsg } from './msgpack';

const hex = (b: Buffer) => b.toString('hex');

describe('packMsg', () => {
  it('encodes the basic types like the msgpack spec', () => {
    expect(hex(packMsg({ a: 1, b: 'x', c: true, d: null, e: undefined }))).toBe('84a16101a162a178a163c3a164c0');
    expect(hex(packMsg([-1, 300, 1.5]))).toBe('93ffce0000012ccb3ff8000000000000');
    expect(hex(packMsg(new Uint8Array([1, 2])))).toBe('c4020102');
    expect(hex(packMsg('a'.repeat(40))).slice(0, 4)).toBe('d928');
  });
  it('uses 16-bit headers for long arrays and maps', () => {
    expect(hex(packMsg(Array(20).fill(0))).slice(0, 6)).toBe('dc0014');
    const m: Record<string, number> = {};
    for (let i = 0; i < 20; i++) m[`k${i}`] = i;
    expect(hex(packMsg(m)).slice(0, 6)).toBe('de0014');
  });
});
