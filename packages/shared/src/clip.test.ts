import { describe, expect, it } from 'vitest';
import { CLIP_CHUNK_BYTES, CLIP_MAX_BYTES, clipKindOf, clipName, clipPartBytes, clipParts, clipRefusal, clipSize, clipType } from './clip';
import { SendDachiMessageBody } from './dachiVoice';

describe('Bluena 📎: what a file is', () => {
  it('sorts files by their type, or by their name when the device gives none', () => {
    expect(clipKindOf('image/jpeg')).toBe('photo');
    expect(clipKindOf('image/HEIC')).toBe('photo');
    expect(clipKindOf('', 'IMG_0001.HEIC')).toBe('photo');
    expect(clipKindOf('video/quicktime')).toBe('video');
    expect(clipKindOf('application/octet-stream', 'clip.mov')).toBe('video');
    expect(clipKindOf('audio/x-m4a')).toBe('audio');
    expect(clipKindOf('', 'memo.m4a')).toBe('audio');
    expect(clipKindOf('application/pdf')).toBe('file');
    expect(clipKindOf('', 'plan.docx')).toBe('file');
    expect(clipType('Text/Plain; charset=utf-8')).toBe('text/plain');
  });

  it('refuses what Bluena does not keep, and what is too big', () => {
    expect(clipKindOf('application/x-msdownload', 'setup.exe')).toBeNull();
    expect(clipKindOf('image/svg+xml')).toBeNull();
    expect(clipKindOf('text/html', 'a.html')).toBeNull();
    expect(clipRefusal({ type: 'application/x-sh', name: 'a.sh', size: 10 })).toMatch(/送れない/);
    expect(clipRefusal({ type: 'video/mp4', name: 'a.mp4', size: CLIP_MAX_BYTES.video + 1 })).toBe('動画は 100MB まで');
    expect(clipRefusal({ type: 'image/png', name: 'a.png', size: 0 })).toMatch(/からっぽ/);
    expect(clipRefusal({ type: 'audio/mpeg', name: 'a.mp3', size: 5_000_000 })).toBeNull();
  });

  it('cuts an upload into pieces under the request limit', () => {
    expect(CLIP_CHUNK_BYTES).toBeLessThan(32 * 1024 * 1024);
    expect(clipParts(1)).toBe(1);
    expect(clipParts(CLIP_CHUNK_BYTES)).toBe(1);
    expect(clipParts(CLIP_CHUNK_BYTES + 1)).toBe(2);
    const size = CLIP_CHUNK_BYTES * 2 + 5;
    expect([0, 1, 2].map((n) => clipPartBytes(size, n))).toEqual([CLIP_CHUNK_BYTES, CLIP_CHUNK_BYTES, 5]);
    expect(clipPartBytes(size, 3)).toBe(0);
    expect(clipPartBytes(size, -1)).toBe(0);
  });

  it('says sizes and names plainly', () => {
    expect(clipSize(300)).toBe('1KB');
    expect(clipSize(820 * 1024)).toBe('820KB');
    expect(clipSize(3.4 * 1024 * 1024)).toBe('3.4MB');
    expect(clipSize(42 * 1024 * 1024)).toBe('42MB');
    expect(clipName('C:\\Users\\me\\レシピ.pdf')).toBe('レシピ.pdf');
    expect(clipName('a\u0000b.txt')).toBe('ab.txt');
    expect(clipName('   ')).toBe('file');
  });

  it('a file goes into a ダチ talk by its id', () => {
    expect(SendDachiMessageBody.safeParse({ fileId: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
    expect(SendDachiMessageBody.safeParse({ fileId: 'nope' }).success).toBe(false);
  });
});
