import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MockProvider } from '@obolo/ai';
import { lyricsEdit, lyricsFallback, SaveSpellBody, SPELL_BOOK_MAX, songSpellKey, spellFrom, spellKey, type SpellTag } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from '../auth/auth.guard';
import type { spellBook } from '../db/schema';
import { cleanRead, MoonCompassService } from './moon-compass.service';
import { SpellBookService } from './spell-book.service';
import { SpellToolsController } from './spell-tools.controller';

type Row = typeof spellBook.$inferSelect;

/** the service over an in-memory table (its DB methods stood in for, each still by user id) */
function bookOf() {
  const rows: Row[] = [];
  let n = 0;
  const s = new SpellBookService({} as never);
  Object.assign(s, {
    rows: async (u: string) => rows.filter((r) => r.userId === u).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    insert: async (v: Partial<Row>) => {
      const r = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, usedAt: null, createdAt: new Date(Date.now() + n), updatedAt: new Date(), ...v } as Row;
      rows.push(r);
      return r;
    },
    update: async (u: string, id: string, set: Partial<Row>) => {
      const r = rows.find((x) => x.id === id && x.userId === u);
      if (!r) throw new Error('not found');
      Object.assign(r, set);
      return r;
    },
    delete: async (u: string, id: string) => {
      const i = rows.findIndex((x) => x.id === id && x.userId === u);
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
  });
  return { s, rows };
}
const status = async (p: Promise<unknown>) => p.then(() => 200, (e: { getStatus?: () => number }) => e.getStatus?.() ?? 500);

describe('R12 spell book: POST/GET/PATCH/DELETE /moon/spellbook', () => {
  it('only signed-in members (AuthGuard on the whole controller)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SpellToolsController)).toContain(AuthGuard);
  });
  it('keeps a spell with a name from its content; the same tags again is the one kept', async () => {
    const { s } = bookOf();
    const tags = spellFrom('song', '夏の海のポップ');
    const a = await s.save('u1', { kind: 'song', tags });
    expect(a).toMatchObject({ kind: 'song', name: '夏の海のポップ' });
    expect(a.already).toBeUndefined();
    const b = await s.save('u1', { kind: 'song', tags });
    expect(b).toMatchObject({ id: a.id, already: true });
    expect(await s.list('u1')).toHaveLength(1);
  });
  it('R13: a song spell keeps both parts — style talismans and the lyrics with metatags — and gives both back', async () => {
    const { s, rows } = bookOf();
    const tags = spellFrom('song', '夏の海のポップ');
    const lyrics = lyricsFallback(tags);
    const a = await s.save('u1', { kind: 'song', tags, lyrics });
    expect(a.lyrics).toEqual(lyrics);
    expect(rows[0].spellKey).toBe(songSpellKey(a.tags, lyrics));
    // the same pair again is the one kept; the same tags with other lyrics is another spell
    expect((await s.save('u1', { kind: 'song', tags, lyrics })).already).toBe(true);
    const other = lyricsEdit(lyrics, 'ささやきを外して')!.lyrics;
    const b = await s.save('u1', { kind: 'song', tags, lyrics: other });
    expect(b.already).toBeUndefined();
    const back = (await s.list('u1')).find((x) => x.id === a.id)!;
    expect(back.lyrics?.blocks.map((x) => x.section)).toEqual(lyrics.blocks.map((x) => x.section));
    // the tags-only spell (a compass reading) has no lyrics
    const c = await s.save('u1', { kind: 'song', tags: spellFrom('song', '雨の街のジャズ') });
    expect(c.lyrics).toBeUndefined();
    // lyrics only with a song spell
    expect(SaveSpellBody.safeParse({ kind: 'art', tags: spellFrom('art', '夜の海'), lyrics }).success).toBe(false);
  });
  it('another spell with the same name gets a number; a rename stays unique and clean', async () => {
    const { s } = bookOf();
    await s.save('u1', { kind: 'song', tags: spellFrom('song', '夏の海のポップ') });
    const b = await s.save('u1', { kind: 'song', tags: spellFrom('song', '夏の海のポップ、ピアノ') .filter((t) => t.ja !== 'ドラム') });
    expect(b.name).toBe('夏の海のポップ2');
    const r = await s.rename('u1', b.id, { name: '「夏のうた」' });
    expect(r.name).toBe('夏のうた');
    const r2 = await s.rename('u1', b.id, { name: '夏の海のポップ' });
    expect(r2.name).toBe('夏の海のポップ2');
  });
  it(`at most ${SPELL_BOOK_MAX}: one more is refused (409) until one is thrown away`, async () => {
    const { s, rows } = bookOf();
    const one = (i: number): SpellTag[] => [{ ja: `星${i}`, en: `star ${i}`, group: 'theme' }, { ja: 'ポップ', en: 'pop', group: 'genre' }];
    for (let i = 0; i < SPELL_BOOK_MAX; i++) rows.push({ id: `id-${i}`, userId: 'u1', kind: 'song', name: `n${i}`, tagsJson: one(i), lyricsJson: null, spellKey: spellKey('song', one(i)), usedAt: null, createdAt: new Date(i), updatedAt: new Date(i) });
    expect(await status(s.save('u1', { kind: 'song', tags: one(999) }))).toBe(409);
    // another member's book is their own
    expect(await status(s.save('u2', { kind: 'song', tags: one(999) }))).toBe(200);
    await s.remove('u1', 'id-0');
    expect(await status(s.save('u1', { kind: 'song', tags: one(999) }))).toBe(200);
  });
  it('another member’s spell can not be renamed, used or thrown away (404)', async () => {
    const { s } = bookOf();
    const a = await s.save('u1', { kind: 'art', tags: spellFrom('art', '夜の海の水彩') });
    expect(await status(s.rename('u2', a.id, { name: 'x' }))).toBe(404);
    expect(await status(s.used('u2', a.id))).toBe(404);
    expect(await status(s.remove('u2', a.id))).toBe(404);
    expect((await s.used('u1', a.id)).usedAt).toBeTruthy();
    expect(await s.remove('u1', a.id)).toEqual({ ok: true });
    expect(await s.list('u1')).toEqual([]);
  });
  it('the talismans are the dictionary’s own labels again (no stray English, no second genre)', async () => {
    const { s } = bookOf();
    const a = await s.save('u1', { kind: 'song', tags: [{ ja: 'ポップ', en: 'POP!!', group: 'genre' }, { ja: 'ロック', en: 'rock', group: 'genre' }, { ja: '花火', en: '花火', group: 'theme' }] });
    expect(a.tags).toEqual([{ ja: '花火', en: '花火', group: 'theme' }, { ja: 'ポップ', en: 'pop', group: 'genre' }]);
  });
});

/** a model that answers the compass as given (perceive / chat), counting the calls */
function llmOf(o: { perceive?: (input: unknown) => Promise<string>; chat?: () => Promise<string> }) {
  const calls = { perceive: [] as unknown[], chat: 0 };
  const llm = {
    name: 'test',
    chat: async () => {
      calls.chat++;
      if (!o.chat) return '{"flagged":false}';
      return o.chat();
    },
    ...(o.perceive
      ? {
          perceive: async (input: unknown) => {
            calls.perceive.push(input);
            return o.perceive!(input);
          },
        }
      : {}),
  };
  return { llm, calls };
}
const SONG = JSON.stringify({
  tags: [
    { ja: '夜のドライブ', en: 'a night drive', group: 'theme' },
    { ja: 'シティポップ', en: '1980s city pop', group: 'genre' },
    { ja: 'しっとり', en: 'mellow', group: 'mood' },
    { ja: 'シンセ', en: 'synthesizer', group: 'instrument' },
    { ja: 'ミラクル', en: 'Miracle Night by Some Singer', group: 'theme' },
    { ja: 'Some Singer風', en: 'vocals like Some Singer', group: 'voice' },
  ],
});

describe('R12 compass: POST /moon/compass', () => {
  const url = 'https://youtu.be/dQw4w9WgXcQ';
  it('a YouTube link: the model watches the video (the link as it is); no names, no title words', async () => {
    const { llm, calls } = llmOf({ perceive: async () => SONG });
    const s = new MoonCompassService(llm as never, {} as never);
    Object.assign(s, { oembed: async () => ({ title: 'Miracle Night (Official Video)', author: 'Some Singer' }) });
    const r = await s.read('u1', { url });
    expect(calls.perceive[0]).toEqual({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(r.kind).toBe('song');
    expect(r.via).toBe('video');
    const all = JSON.stringify(r.tags);
    expect(all).not.toMatch(/Miracle|Singer|ミラクル/);
    expect(r.tags.map((t) => t.ja)).toEqual(expect.arrayContaining(['夜のドライブ', 'シティポップ', 'しっとり', 'シンセ']));
    // a song spell is whole: a tempo and a voice too
    expect(r.tags.some((t) => t.group === 'tempo') && r.tags.some((t) => t.group === 'voice')).toBe(true);
  });
  it('the video can not be read: the oEmbed title and channel are only a hint for the model (text)', async () => {
    const { llm, calls } = llmOf({ perceive: async () => Promise.reject(new Error('video not supported')), chat: async () => SONG });
    const s = new MoonCompassService(llm as never, {} as never);
    Object.assign(s, { oembed: async () => ({ title: 'Miracle Night', author: 'Some Singer' }) });
    const r = await s.read('u1', { url });
    expect(r.via).toBe('title');
    expect(calls.chat).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r.tags)).not.toMatch(/Miracle|Singer/);
  });
  it('neither the video nor its title: the compass could not read it (502)', async () => {
    const { llm } = llmOf({ perceive: async () => '{}' });
    const s = new MoonCompassService(llm as never, {} as never);
    Object.assign(s, { oembed: async () => null });
    expect(await status(s.read('u1', { url }))).toBe(502);
  });
  it('a photo handed to bati: only your own photo is read into a picture spell', async () => {
    const { llm, calls } = llmOf({ perceive: async () => JSON.stringify({ tags: [{ ja: '夕暮れの海辺', en: 'a seaside at dusk', group: 'theme' }, { ja: '水彩', en: 'watercolor', group: 'style' }, { ja: '夕焼け', en: 'sunset light', group: 'light' }, { ja: 'ギター', en: 'guitar', group: 'instrument' }] }) });
    const photos = new Map([['u1:f1', { mime: 'image/jpeg', data: Buffer.from('jpg') }]]);
    const s = new MoonCompassService(llm as never, { photo: async (u: string, id: string) => photos.get(`${u}:${id}`) ?? null } as never);
    const r = await s.read('u1', { fileId: 'f1' });
    expect(r).toMatchObject({ kind: 'art', via: 'image' });
    expect((calls.perceive[0] as { mime: string }).mime).toBe('image/jpeg');
    expect(r.tags.map((t) => t.ja)).toEqual(expect.arrayContaining(['夕暮れの海辺', '水彩', '夕焼け']));
    // a song's group is not a picture's
    expect(r.tags.some((t) => t.group === 'instrument')).toBe(false);
    expect(await status(s.read('u2', { fileId: 'f1' }))).toBe(404);
  });
  it('a pasted image is read the same way; the offline model gives its fixed read', async () => {
    const s = new MoonCompassService(new MockProvider() as never, {} as never);
    const r = await s.read('u1', { image: { mime: 'image/png', data: Buffer.from('png').toString('base64') } });
    expect(r.tags.map((t) => t.ja)).toEqual(expect.arrayContaining(['水彩', '夕焼け']));
  });
  it('cleanRead drops names and Latin labels, keeps the common genre words (in the dictionary’s labels)', () => {
    const tags = cleanRead('song', JSON.stringify({ tags: [{ ja: 'EDM', en: 'dance, EDM', group: 'genre' }, { ja: 'Taylor風', en: 'pop', group: 'genre' }, { ja: '明るい', en: 'bright', group: 'mood' }, { ja: '声', en: 'sounds like Jane Doe', group: 'voice' }] }));
    expect(tags.map((t) => t.ja)).toEqual(['EDM', '明るい']); // R13 fix: EDM is a genre talisman of its own
  });
});
