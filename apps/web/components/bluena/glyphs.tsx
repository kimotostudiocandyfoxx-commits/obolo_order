import type { SVGProps } from 'react';

/**
 * Bluena's marks (docs/工房とブルーナ_設計.md §2.1): thin lines of one weight, so the folders read by
 * their mark — never by a word under the icon. Each mark has a name for screen readers only.
 */
export type GlyphId = 'voice' | 'art' | 'song' | 'video' | 'radio' | 'goods' | 'game' | 'book' | 'kept' | 'works' | 'comms' | 'any';

export const GLYPH_NAMES: Record<GlyphId, string> = {
  voice: '声',
  art: 'アート',
  song: '曲',
  video: '動画・MV',
  radio: 'ラジオ番組',
  goods: 'グッズ',
  game: 'ゲーム',
  book: '本',
  kept: 'しまった作品',
  works: '作品',
  comms: '通信',
  any: 'おまかせ',
};

const PATHS: Record<GlyphId, React.ReactNode> = {
  // 音の波
  voice: <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0" />,
  // 正方形の額
  art: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <rect x="7" y="7" width="10" height="10" />
    </>
  ),
  // 音符
  song: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="16" r="2.2" />
    </>
  ),
  // 再生の三角
  video: <path d="M8 5.5v13l10.5-6.5z" />,
  // 放送の電波 ((•))
  radio: (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  // ひし形の宝石
  goods: <path d="M12 3l7 7-7 11-7-11zM5 10h14M9.5 10L12 21l2.5-11M9 3.8 9.5 10M15 3.8l-.5 6.2" />,
  // ゲームの札
  game: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M12 8.5l1.6 3.5L12 15.5 10.4 12z" />
    </>
  ),
  // 開いた本
  book: <path d="M3 6c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5v12c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5zM12 6.5v12" />,
  // しまった作品（小さなしおり）
  kept: <path d="M7 3h10v18l-5-4-5 4z" />,
  // 正方形の作品集
  works: (
    <>
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </>
  ),
  // 吹き出し
  comms: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  // おまかせ（星のきらめき）
  any: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
};

export function Glyph({ id, label = true, ...rest }: { id: GlyphId; label?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label ? GLYPH_NAMES[id] : undefined}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {PATHS[id]}
    </svg>
  );
}
