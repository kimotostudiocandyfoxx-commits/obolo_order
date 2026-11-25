import { describe, expect, it } from 'vitest';
import { findUrls, isWebUrl, linkDomain, linkKind, splitUrls, wordsAndLinks, youtubeId } from './links';

describe('links: finding URLs in a message', () => {
  it('finds http(s) and www. URLs, leaving the sentence punctuation out', () => {
    expect(findUrls('見て https://example.com/a?b=1。').map((f) => f.url)).toEqual(['https://example.com/a?b=1']);
    expect(findUrls('see https://example.com/x, and http://foo.jp!').map((f) => f.url)).toEqual(['https://example.com/x', 'http://foo.jp']);
    expect(findUrls('www.example.org/page.').map((f) => f.url)).toEqual(['https://www.example.org/page']);
    expect(findUrls('「https://example.com/日本」だよ').map((f) => f.url)).toEqual(['https://example.com/日本']);
    expect(findUrls('URL　https://a.example.com　です').map((f) => f.url)).toEqual(['https://a.example.com']);
  });

  it('keeps balanced brackets, drops a closing one the URL did not open', () => {
    expect(findUrls('(https://en.wikipedia.org/wiki/Moon_(disambiguation))').map((f) => f.url)).toEqual(['https://en.wikipedia.org/wiki/Moon_(disambiguation)']);
    expect(findUrls('(see https://example.com/a)').map((f) => f.url)).toEqual(['https://example.com/a']);
  });

  it('ignores what is not a web URL', () => {
    expect(findUrls('javascript:alert(1) ftp://x.com/a file:///etc/passwd')).toEqual([]);
    expect(findUrls('http://localhost')).toEqual([]);
    expect(findUrls('https://user:pw@example.com')).toEqual([]);
    expect(isWebUrl('https://example.com')).toBe(true);
    expect(isWebUrl('data:text/html,hi')).toBe(false);
  });

  it('gives the positions in the text', () => {
    const t = 'a https://x.com/b c';
    const [f] = findUrls(t);
    expect(t.slice(f.start, f.end)).toBe('https://x.com/b');
  });
});

describe('links: splitting a message', () => {
  it('splits words and URLs in order, trimmed', () => {
    expect(splitUrls('これ見て https://example.com/a いいよね')).toEqual([
      { t: 'text', s: 'これ見て' },
      { t: 'url', url: 'https://example.com/a' },
      { t: 'text', s: 'いいよね' },
    ]);
    expect(splitUrls('https://example.com')).toEqual([{ t: 'url', url: 'https://example.com' }]);
    expect(splitUrls('ただの言葉')).toEqual([{ t: 'text', s: 'ただの言葉' }]);
    expect(splitUrls('')).toEqual([]);
  });

  it('turns at most `max` URLs into portals; the rest stay words', () => {
    const t = 'https://a.com https://b.com https://c.com https://d.com';
    const parts = splitUrls(t, 3);
    expect(parts.filter((p) => p.t === 'url')).toHaveLength(3);
    expect(parts.at(-1)).toEqual({ t: 'text', s: 'https://d.com' });
  });

  it('words and links: the words joined, the URLs once each', () => {
    expect(wordsAndLinks('見て https://a.com と https://a.com')).toEqual({ words: '見て\nと', urls: ['https://a.com'] });
    expect(wordsAndLinks('https://a.com')).toEqual({ words: '', urls: ['https://a.com'] });
  });
});

describe('links: kinds', () => {
  it('knows YouTube, Spotify, SoundCloud', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtube.com/channel/abc')).toBeNull();
    expect(linkKind('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(linkKind('https://open.spotify.com/track/abc')).toBe('spotify');
    expect(linkKind('https://soundcloud.com/a/b')).toBe('soundcloud');
    expect(linkKind('https://example.com')).toBe('web');
    expect(linkDomain('https://www.example.com/a')).toBe('example.com');
  });
});
