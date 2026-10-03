import { describe, expect, it } from 'vitest';
import { cdnUrl, extForMime, mediaKey } from './index';

describe('media keys', () => {
  it('maps mime to extension', () => {
    expect(extForMime('audio/mp4')).toBe('m4a');
    expect(extForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extForMime('weird/type')).toBe('bin');
  });
  it('builds sharded keys', () => {
    const k = mediaKey('voice', 'user-1', 'audio/webm', 'abc');
    expect(k).toMatch(/^voice\/[0-9a-f]{2}\/user-1\/abc\.webm$/);
    expect(cdnUrl({ cdnHost: 'x.b-cdn.net' }, k)).toBe(`https://x.b-cdn.net/${k}`);
  });
});
