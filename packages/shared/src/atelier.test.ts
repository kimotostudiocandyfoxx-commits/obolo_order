import { describe, expect, it } from 'vitest';
import { ATELIER_MAX_ITEMS, AtelierLayout } from './atelier';

const item = (over: Record<string, unknown> = {}) => ({ id: 'a1', kind: 'sticker', x: 0.5, y: 0.4, size: 0.2, url: '/x.jpg', ...over });

describe('the Uranus atelier layout', () => {
  it('fills in defaults', () => {
    const l = AtelierLayout.parse({ items: [item()] });
    expect(l.wall).toBe('cream');
    expect(l.items[0]).toMatchObject({ rot: 0, flip: false, text: '', poster: null });
  });
  it('takes only our own files', () => {
    expect(AtelierLayout.safeParse({ items: [item({ url: 'javascript:alert(1)' })] }).success).toBe(false);
    expect(AtelierLayout.safeParse({ items: [item({ url: 'data:image/png;base64,AAAA' })] }).success).toBe(false);
    expect(AtelierLayout.safeParse({ items: [item({ url: 'https://cdn.example.com/a.jpg' })] }).success).toBe(true);
  });
  it('keeps pieces inside the room and limits how many', () => {
    expect(AtelierLayout.safeParse({ items: [item({ x: 1.4 })] }).success).toBe(false);
    expect(AtelierLayout.safeParse({ items: Array.from({ length: ATELIER_MAX_ITEMS + 1 }, (_, k) => item({ id: `i${k}` })) }).success).toBe(false);
  });
});
