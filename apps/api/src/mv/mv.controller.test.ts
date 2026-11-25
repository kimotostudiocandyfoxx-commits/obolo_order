import { spellFrom, spellKey, VIDEO_DEFAULTS, VIDEO_EDITS_PER_DAY, withSong } from '@obolo/shared';
import { describe, expect, it, vi } from 'vitest';
import { MvController } from './mv.controller';

const SONG = { id: '11111111-1111-4111-8111-111111111111', title: '夏の海のポップ' };
const MV = '22222222-2222-4222-8222-222222222222';
const yes = (price: number, spell?: string) => ({ id: '7d1f6a3e-2b4c-4d5e-8f90-1a2b3c4d5e6f', price, ...(spell ? { spell } : {}) });
const req = { protocol: 'https', get: () => 'api.example' } as never;

function setup(o: { pictures?: string[]; cut?: boolean } = {}) {
  const jobs = { create: vi.fn(async (_u: string, kind: string, input: unknown) => ({ id: 'job-1', kind, input })), get: vi.fn() };
  const ledger = { charge: vi.fn(async () => ({ refund: vi.fn(), repeat: false })) };
  const store = new Map<string, number>();
  const kv = { get: vi.fn(async () => null), set: vi.fn(), incr: vi.fn(async (k: string) => store.set(k, (store.get(k) ?? 0) + 1).get(k)!) };
  const cut = o.cut === false ? null : { params: VIDEO_DEFAULTS, order: [0, 1, 2], scenes: [{ url: 'a', dur: 1 }, { url: 'b', dur: 1 }, { url: 'c', dur: 1 }] };
  const mv = { ownPictures: vi.fn(async () => o.pictures ?? ['https://x/1.webp', 'https://x/2.webp']), get: vi.fn(async () => ({ id: MV, cut })) };
  const c = new MvController(mv as never, jobs as never, ledger as never, {} as never, kv as never);
  return { c, jobs, ledger, kv, mv };
}

describe('R13: the video endpoints', () => {
  it('from the member’s own pictures: the low price (mvPictures) with the yes for exactly that spell; nothing painted', async () => {
    const { c, jobs, ledger } = setup();
    const spell = withSong(spellFrom('video', '自分の絵をつないで'), SONG);
    await c.pictures('u1', MV, { spell, confirm: yes(2, spellKey('video', spell)), from: 'atelier' }, req);
    expect(ledger.charge).toHaveBeenCalledWith(expect.anything(), 'u1', 'mvPictures', MV, expect.objectContaining({ required: true, spell: spellKey('video', spell) }));
    expect(jobs.create).toHaveBeenCalledWith('u1', 'mv-edit', expect.objectContaining({ mode: 'pictures', tags: spell, pay: 'mvPictures' }));
  });
  it('no pictures of their own: refused before any charge', async () => {
    const { c, ledger } = setup({ pictures: [] });
    const spell = spellFrom('video', '自分の写真をつないで');
    await expect(c.pictures('u1', MV, { spell, confirm: yes(2, spellKey('video', spell)) }, req)).rejects.toMatchObject({ status: 400 });
    expect(ledger.charge).not.toHaveBeenCalled();
  });
  it('a free change: no charge, a re-render job; capped a day', async () => {
    const { c, jobs, ledger } = setup();
    const body = { params: { ...VIDEO_DEFAULTS, pace: 'slow' }, order: [0, 1, 2] };
    await c.edit('u1', MV, body, req);
    expect(ledger.charge).not.toHaveBeenCalled();
    expect(jobs.create).toHaveBeenCalledWith('u1', 'mv-edit', expect.objectContaining({ mode: 'edit', edit: expect.objectContaining({ params: expect.objectContaining({ pace: 'slow' }) }) }));
    for (let i = 1; i < VIDEO_EDITS_PER_DAY; i++) await c.edit('u1', MV, body, req);
    await expect(c.edit('u1', MV, body, req)).rejects.toMatchObject({ status: 429 });
  });
  it('a video made before the cut was kept cannot be changed by words', async () => {
    const { c } = setup({ cut: false });
    await expect(c.edit('u1', MV, { params: VIDEO_DEFAULTS, order: [0] }, req)).rejects.toMatchObject({ status: 400 });
  });
  it('a scene painted again: the small price (mvRedraw) with its yes', async () => {
    const { c, jobs, ledger } = setup();
    const spell = spellFrom('video', '水彩');
    await c.redraw('u1', MV, { scenes: [2], spell, confirm: yes(2, spellKey('video', spell)) }, req);
    expect(ledger.charge).toHaveBeenCalledWith(expect.anything(), 'u1', 'mvRedraw', MV, expect.anything());
    expect(jobs.create).toHaveBeenCalledWith('u1', 'mv-edit', expect.objectContaining({ mode: 'redraw', scenes: [2] }));
  });
  it('the painted MV carries its spell and its yes into the job (the mana goes back if it fails)', async () => {
    const { c, jobs, ledger } = setup();
    const spell = withSong(spellFrom('video', '夏の海'), SONG);
    await c.story('u1', MV, { from: 'atelier', spell, confirm: yes(8, spellKey('video', spell)) }, req);
    expect(ledger.charge).toHaveBeenCalledWith(expect.anything(), 'u1', 'mv', MV, expect.anything());
    expect(jobs.create).toHaveBeenCalledWith('u1', 'mv-story', expect.objectContaining({ tags: spell, pay: 'mv' }));
  });
});
