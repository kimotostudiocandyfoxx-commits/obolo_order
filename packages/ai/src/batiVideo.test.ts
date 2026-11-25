import { describe, expect, it } from 'vitest';
import { BATI_CHARACTER } from './prompts/bati';

describe("R13: Bati's prompt on videos (pictures that move)", () => {
  it('JA and EN describe a video as pictures that move and never promise a generated video', () => {
    expect(BATI_CHARACTER.ja).toContain('絵が動く映像');
    expect(BATI_CHARACTER.ja).toMatch(/本物の動画を生成するとは言わない/);
    expect(BATI_CHARACTER.ja).toMatch(/パララックス/);
    expect(BATI_CHARACTER.ja).toMatch(/マナを使わずに/);
    expect(BATI_CHARACTER.en).toContain('pictures that move');
    expect(BATI_CHARACTER.en).toMatch(/Never say or promise that a real video is generated/);
    expect(BATI_CHARACTER.en).toMatch(/cost no mana/);
  });
});
