import { describe, expect, it } from 'vitest';
import { exprFor } from './expression';

describe('exprFor', () => {
  it('KIMORIN blushes at 「ア、、、アイ//？」 (client 2026-11-22)', () => {
    expect(exprFor('KIMORIN', 'ア、、、アイ//？')).toBe('blush');
    expect(exprFor('KIMORIN⭐︎', 'ア、、、アイ//？')).toBe('blush');
  });
  it('other lines keep their faces', () => {
    expect(exprFor('KIMORIN', '仕組みはこうです')).toBe('lecture');
    expect(exprFor('OBOLON', 'アイ//')).toBe('talk');
  });
});
