import { CLIP_MAX_BYTES, CLIP_PICK_MAX, type ClipFile } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { CLIP_ACCEPT, extOf, keptWhen, lengthWord, progressOf, readyFiles, rowProgress, rowsOf, rowSub, sheetWords, sizeWord } from './rows';

const file = (id: string): ClipFile => ({
  id,
  kind: 'photo',
  name: `${id}.jpg`,
  mime: 'image/webp',
  sizeBytes: 2048,
  createdAt: '2026-11-24T00:00:00Z',
});

describe("Bluena's 📎 sheet", () => {
  it('asks the picker for pictures, films, sounds and documents (not HEIC, so iOS gives a JPEG)', () => {
    expect(CLIP_ACCEPT).toContain('image/*');
    expect(CLIP_ACCEPT).toContain('video/*');
    expect(CLIP_ACCEPT).toContain('audio/*');
    expect(CLIP_ACCEPT).toContain('application/pdf');
    expect(CLIP_ACCEPT).toContain('.docx');
    expect(CLIP_ACCEPT).not.toMatch(/heic/i);
  });

  it('makes rows of what was picked: refused ones say why, at most a few at once', () => {
    const rows = rowsOf([
      { name: 'IMG_1.JPG', size: 3_000_000, type: 'image/jpeg' },
      {
        name: 'big.mov',
        size: CLIP_MAX_BYTES.video + 1,
        type: 'video/quicktime',
      },
      { name: 'app.exe', size: 10, type: 'application/x-msdownload' },
      { name: 'memo.m4a', size: 900_000, type: '' },
    ]);
    expect(rows.map((r) => [r.kind, r.state])).toEqual([
      ['photo', 'wait'],
      ['video', 'bad'],
      [null, 'bad'],
      ['audio', 'wait'],
    ]);
    expect(rows[1].note).toBe('動画は 100MB まで');
    expect(new Set(rows.map((r) => r.key)).size).toBe(4);
    const many = Array.from({ length: 10 }, (_, k) => ({
      name: `${k}.png`,
      size: 10,
      type: 'image/png',
    }));
    expect(rowsOf(many)).toHaveLength(CLIP_PICK_MAX);
    expect(rowsOf(many, CLIP_PICK_MAX - 2)).toHaveLength(2);
  });

  it('counts the progress by bytes, the refused rows left out', () => {
    const [a, b, bad] = rowsOf([
      { name: 'a.png', size: 100, type: 'image/png' },
      { name: 'b.pdf', size: 300, type: 'application/pdf' },
      { name: 'c.exe', size: 999, type: 'application/x-msdownload' },
    ]);
    expect(progressOf([a, b, bad])).toBe(0);
    expect(progressOf([{ ...a, state: 'ready', file: file('a') }, { ...b, state: 'up', sent: 150 }, bad])).toBeCloseTo(250 / 400);
    expect(rowProgress({ ...b, state: 'up', sent: 300 })).toBeLessThan(1);
    expect(rowProgress({ ...b, state: 'ready' })).toBe(1);
    expect(rowSub({ ...b, state: 'up', sent: 150 })).toBe('ファイル・50%');
    expect(rowSub({ ...a, state: 'ready', file: file('a') })).toBe('写真・2KB');
    expect(rowSub(bad)).toMatch(/送れない/);
    expect(readyFiles([{ ...a, state: 'ready', file: file('a') }, b, bad]).map((f) => f.id)).toEqual(['a']);
  });

  it('says where the files go', () => {
    expect(sheetWords('dachi', 'モチ')).toMatchObject({
      title: 'この会話に送る',
      go: '送る',
    });
    expect(sheetWords('bati', 'モチ')).toMatchObject({
      title: 'モチにわたす',
      go: 'わたす',
    });
    expect(sheetWords('keep', 'モチ')).toMatchObject({
      title: 'ブルーナにしまう',
      go: 'しまう',
    });
  });

  it('small words: sizes, lengths, kinds of document, when', () => {
    expect(sizeWord(512)).toBe('1KB');
    expect(sizeWord(5.25 * 1024 * 1024)).toBe('5.3MB');
    expect(lengthWord(42)).toBe('0:42');
    expect(lengthWord(725)).toBe('12:05');
    expect(lengthWord(null)).toBe('');
    expect(extOf('レシピ.pdf')).toBe('PDF');
    expect(extOf('noext')).toBe('');
    const now = new Date(2026, 10, 24, 12, 0);
    expect(keptWhen(new Date(2026, 10, 24, 6, 49).toISOString(), now)).toBe('きょう 06:49');
    expect(keptWhen(new Date(2026, 10, 20, 21, 5).toISOString(), now)).toBe('11/20 21:05');
  });
});
