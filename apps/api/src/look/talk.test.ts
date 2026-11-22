import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { findPart, storedTalk, talkLookOf } from './talk';

/** a 320×400 figure (a pink disc for a head, a body below) with an optional dark mouth / eye bar, shifted by dx */
async function figure(o: { mouth?: boolean; eyes?: boolean; dx?: number } = {}) {
  const dx = o.dx ?? 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400">
    <rect x="${90 + dx}" y="180" width="140" height="210" fill="#5a7bd8"/>
    <circle cx="${160 + dx}" cy="110" r="80" fill="#f4c7b0"/>
    <circle cx="${130 + dx}" cy="95" r="9" fill="#222"/><circle cx="${190 + dx}" cy="95" r="9" fill="#222"/>
    ${o.eyes ? `<rect x="${116 + dx}" y="86" width="88" height="18" fill="#f4c7b0"/><rect x="${118 + dx}" y="94" width="24" height="3" fill="#222"/><rect x="${178 + dx}" y="94" width="24" height="3" fill="#222"/>` : ''}
    <rect x="${145 + dx}" y="140" width="30" height="${o.mouth ? 16 : 3}" rx="2" fill="#7a2030"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('M-R235 the parts found by differencing', () => {
  it('finds the open mouth where it changed, as a small box', async () => {
    const p = await findPart(await figure(), await figure({ mouth: true }), [0.05, 0.6]);
    expect(p).not.toBeNull();
    const { x, y, w, h } = p!.box;
    // the mouth: x 145–175 of 320, y 140–156 of 400
    expect(x).toBeGreaterThan(0.4);
    expect(x + w).toBeLessThan(0.6);
    expect(y).toBeGreaterThan(0.3);
    expect(y + h).toBeLessThan(0.45);
    const meta = await sharp(p!.png).metadata();
    expect(meta.width).toBeLessThan(80);
  });
  it('finds the closed eyes even when the edit moved a pixel or two', async () => {
    const p = await findPart(await figure(), await figure({ eyes: true, dx: 2 }), [0, 0.5]);
    expect(p).not.toBeNull();
    expect(p!.box.y).toBeLessThan(0.25);
    expect(p!.box.w).toBeLessThan(0.4);
  });
  it('gives nothing when nothing changed, or when the whole figure was redrawn', async () => {
    expect(await findPart(await figure(), await figure())).toBeNull();
    const other = await sharp({ create: { width: 320, height: 400, channels: 4, background: '#30a050' } }).png().toBuffer();
    expect(await findPart(await figure(), other)).toBeNull();
  });
});

describe('the talk look kept with the account', () => {
  it('is used only for the picture it was made from', () => {
    const j = { 'talk.me': JSON.stringify({ of: 'https://x/a.png', stand: 'https://x/a-stand.png' }) };
    expect(storedTalk(j, 'me', 'https://x/a.png')?.stand).toBe('https://x/a-stand.png');
    expect(storedTalk(j, 'me', 'https://x/b.png')).toBeNull();
  });
  it('stands in with the standee / {bati} faces while it is made', () => {
    expect(talkLookOf({ 'look.standee': 'https://x/s.png', 'look.standee.of': 'https://x/a.png' }, 'me', 'https://x/a.png')).toEqual({ of: 'https://x/a.png', stand: 'https://x/s.png', making: true });
    const b = talkLookOf({ 'bati.faces': JSON.stringify({ smile: 'https://x/sm.png', surprise: 'https://x/su.png', yawn: 'https://x/y.png' }) }, 'bati', 'https://x/b.png');
    expect(b?.faces).toEqual({ smile: { kind: 'image', url: 'https://x/sm.png' }, surprised: { kind: 'image', url: 'https://x/su.png' } });
    expect(talkLookOf({}, 'me', null)).toBeNull();
  });
});
