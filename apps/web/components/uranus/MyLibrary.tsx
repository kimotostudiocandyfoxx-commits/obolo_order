'use client';

/**
 * 📚 my図書館 (L2-URANUS-S004, M-R154/M-R158): {neo}'s library on the paper road, built from the part cards {bati}
 * picks from what was said (a fixed table of words — nothing is generated, no mana) and raised shelf by shelf like
 * turning pages. Drawn here in code until the prepared part pictures exist. The books put on its shelves stand in
 * the window; the sign over the door carries up to eight characters.
 */
export type LibraryLook = {
  body: 'brick-tower' | 'wood-house' | 'tree' | 'dome';
  shelves: 'ceiling' | 'low';
  ladder: boolean;
  skylight: 'round' | 'stars' | 'none';
  lamp: boolean;
  ground: 'field' | 'forest' | 'night';
  sign: string;
};
export const LIBRARY_DEFAULT: LibraryLook = { body: 'brick-tower', shelves: 'ceiling', ladder: true, skylight: 'round', lamp: true, ground: 'field', sign: '' };

export function libraryCards(l: LibraryLook): string[] {
  return [
    ...(l.ground !== 'field' ? [{ forest: '森の中', night: '夜の空', field: '' }[l.ground]] : []),
    { 'brick-tower': 'レンガの塔', 'wood-house': '木の小屋', tree: '大きな木の中', dome: 'ガラスの丸屋根' }[l.body],
    l.shelves === 'ceiling' ? '天井まで本棚' : '低い本棚',
    ...(l.ladder ? ['木のはしご'] : []),
    ...(l.skylight !== 'none' ? [l.skylight === 'stars' ? '星の見える天窓' : '丸い天窓'] : []),
    ...(l.lamp ? ['ランプの灯り'] : []),
  ];
}

/** What was said → the parts (unmatched words leave the library as it is). */
export function libraryFromWords(said: string, base: LibraryLook = LIBRARY_DEFAULT): LibraryLook {
  const has = (...w: string[]) => w.some((x) => said.includes(x));
  const l = { ...base };
  if (has('森', 'もり', '木々')) l.ground = 'forest';
  if (has('夜', 'よる', '星')) {
    l.ground = 'night';
    if (l.skylight !== 'none') l.skylight = 'stars';
  }
  if (has('昼', 'ひる', '野原', '明るい')) l.ground = 'field';
  if (has('レンガ', 'れんが', '塔', 'とう', '古い')) l.body = 'brick-tower';
  else if (has('小屋', 'こや', '木造', 'ログ')) l.body = 'wood-house';
  else if (has('木の中', '大きな木', '樹')) l.body = 'tree';
  else if (has('ガラス', '丸屋根', 'ドーム')) l.body = 'dome';
  if (has('天井まで', '高い本棚', 'いっぱい')) l.shelves = 'ceiling';
  else if (has('低い', 'ひくい', '小さな本棚')) l.shelves = 'low';
  if (has('はしごなし', 'はしごはいらない')) l.ladder = false;
  else if (has('はしご', 'ハシゴ')) l.ladder = true;
  if (has('星が見える', '星の見える', '星空')) l.skylight = 'stars';
  else if (has('天窓', '窓')) l.skylight = l.skylight === 'none' ? 'round' : l.skylight;
  if (has('天窓なし', '窓なし')) l.skylight = 'none';
  if (has('ランプ', '灯り', 'あかり', 'ろうそく')) l.lamp = true;
  if (has('暗い', 'くらい', '明かりなし')) l.lamp = false;
  return l;
}

/** 〔おまかせ〕: a library that fits the story (night words → the starry one) */
export function libraryOmakase(story = ''): LibraryLook {
  return libraryFromWords(story, LIBRARY_DEFAULT);
}

const SKY: Record<LibraryLook['ground'], [string, string]> = { field: ['#9fe3dc', '#e6f7ef'], forest: ['#7cc9b8', '#cfeedd'], night: ['#0d1838', '#2b3f6e'] };

export function MyLibrary({ look, rise = 1, books = [], width = 300 }: { look: LibraryLook; rise?: number; books?: { title: string; cover?: string | null }[]; width?: number }) {
  const [s1, s2] = SKY[look.ground];
  const up = Math.min(1, Math.max(0, rise));
  const night = look.ground === 'night';
  const wall = { 'brick-tower': '#b5563c', 'wood-house': '#a8774a', tree: '#7a5a3a', dome: '#d9eef2' }[look.body];
  const tall = look.body === 'brick-tower';
  const top = tall ? 30 : 58;
  const lit = look.lamp && up >= 1;
  return (
    <svg viewBox="0 0 240 170" width={width} height={(width * 170) / 240} className="overflow-hidden rounded-2xl" role="img" aria-label="my図書館">
      <defs>
        <linearGradient id="lbSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s1} />
          <stop offset="100%" stopColor={s2} />
        </linearGradient>
        <clipPath id="lbRise">
          <rect x="0" y={130 - 125 * up} width="240" height={125 * up + 40} />
        </clipPath>
      </defs>
      <rect width="240" height="170" fill="url(#lbSky)" />
      {night && [18, 52, 96, 150, 196, 226, 120, 70].map((x, k) => <circle key={k} cx={x} cy={10 + ((k * 23) % 50)} r={k % 3 ? 0.9 : 1.4} fill="#fff" opacity={0.85} />)}
      {/* the tilted ring of Uranus, far away like the spine of an open book */}
      <ellipse cx="205" cy="34" rx="7" ry="26" fill="none" stroke={night ? '#8fd6e0' : '#ffffff'} strokeWidth="1.2" opacity={0.6} />
      <circle cx="205" cy="34" r="9" fill={night ? '#5fb7c4' : '#bfeff0'} opacity={0.9} />
      {look.ground === 'forest' && [12, 34, 192, 222].map((x) => <path key={x} d={`M${x} 132 L${x - 14} 132 L${x} 84 L${x + 14} 132Z`} fill="#3f8a63" opacity={0.85} />)}
      <rect y="128" width="240" height="42" fill={night ? '#22324f' : '#bfe6a8'} />
      {/* the paper road */}
      <path d="M100 170 Q112 146 118 130 L126 130 Q132 146 150 170Z" fill="#fbf6ea" opacity={0.95} />
      <g clipPath="url(#lbRise)">
        {look.body === 'tree' ? (
          <g>
            <rect x="92" y="70" width="56" height="60" rx="10" fill={wall} />
            <circle cx="120" cy="56" r="44" fill="#4f9b5e" />
            <circle cx="92" cy="66" r="22" fill="#5aa86a" />
            <circle cx="150" cy="64" r="24" fill="#5aa86a" />
          </g>
        ) : look.body === 'dome' ? (
          <path d="M70 130 L70 94 A50 46 0 0 1 170 94 L170 130Z" fill={wall} stroke="#9cc6cf" strokeWidth="1.5" opacity={0.92} />
        ) : (
          <g>
            <rect x={tall ? 92 : 70} y={top} width={tall ? 56 : 100} height={130 - top} fill={wall} />
            {look.body === 'brick-tower' &&
              Array.from({ length: 12 }, (_, r) => <line key={r} x1="92" x2="148" y1={top + 8 * (r + 1)} y2={top + 8 * (r + 1)} stroke="#8a3c28" strokeWidth="0.6" opacity={0.6} />)}
            <path d={tall ? `M86 ${top} L120 ${top - 22} L154 ${top}Z` : `M62 ${top} L120 ${top - 28} L178 ${top}Z`} fill={look.body === 'brick-tower' ? '#4b5d78' : '#6b4a30'} />
          </g>
        )}
        {/* the skylight */}
        {look.skylight !== 'none' && (
          <g>
            <circle cx="120" cy={look.body === 'dome' ? 70 : tall ? top - 8 : top - 10} r="6" fill={night ? '#16244a' : '#bfefff'} stroke="#fbf6ea" strokeWidth="1.2" />
            {look.skylight === 'stars' && <circle cx="122" cy={(look.body === 'dome' ? 70 : tall ? top - 8 : top - 10) - 2} r="1" fill="#fff" />}
          </g>
        )}
        {/* the big window: shelves inside, the books standing */}
        <rect x="100" y={look.shelves === 'ceiling' ? Math.max(top + 10, 60) : 92} width="40" height={look.shelves === 'ceiling' ? 110 - Math.max(top + 10, 60) : 18} fill={lit ? '#ffe7a8' : '#d9cbb0'} stroke="#5a3d26" strokeWidth="1.2" />
        {Array.from({ length: look.shelves === 'ceiling' ? 4 : 1 }, (_, r) => {
          const y = 108 - r * 14;
          return (
            <g key={r}>
              <line x1="100" x2="140" y1={y} y2={y} stroke="#5a3d26" strokeWidth="1" />
              {[0, 1, 2, 3, 4, 5].map((b) => (
                <rect key={b} x={102 + b * 6} y={y - 9 + ((b + r) % 3)} width="4" height={9 - ((b + r) % 3)} fill={['#e5484d', '#3e7bd6', '#e8b33a', '#3aa76d', '#9b59b6', '#e67e22'][(b + r) % 6]} opacity={0.75} />
              ))}
            </g>
          );
        })}
        {look.ladder && (
          <g stroke="#7a4f2a" strokeWidth="1">
            <line x1="132" y1="122" x2="138" y2="80" />
            <line x1="137" y1="122" x2="143" y2="80" />
            {[0, 1, 2, 3, 4].map((k) => (
              <line key={k} x1={133 + k * 1.2} x2={138 + k * 1.2} y1={116 - k * 8} y2={116 - k * 8} />
            ))}
          </g>
        )}
        {/* the door and its sign */}
        <rect x="112" y="112" width="16" height="18" rx="8" fill="#5a3d26" />
        <rect x="96" y="100" width="48" height="10" rx="2" fill="#fbf6ea" stroke="#5a3d26" strokeWidth="0.8" />
        <text x="120" y="107.6" textAnchor="middle" fontSize="6.4" fontWeight={800} fill="#5a3d26">
          {look.sign || '図書館'}
        </text>
        {look.lamp && (
          <g>
            <line x1="150" y1="96" x2="150" y2="130" stroke="#333" strokeWidth="1" />
            <circle cx="150" cy="94" r="3" fill={lit ? '#ffd36f' : '#888'} />
            {lit && <circle cx="150" cy="94" r="9" fill="#ffd36f" opacity={0.25} />}
          </g>
        )}
      </g>
      {/* the books put on the shelf, standing in front with their covers showing */}
      {up >= 1 &&
        books.slice(0, 3).map((b, k) => (
          <g key={k} transform={`translate(${60 + k * 22} 112)`}>
            <rect width="16" height="20" rx="1.5" fill={k ? '#3e7bd6' : '#e5484d'} stroke="#fbf6ea" strokeWidth="0.8" />
            {b.cover && <image href={b.cover} x="1.5" y="1.5" width="13" height="11" preserveAspectRatio="xMidYMid slice" />}
          </g>
        ))}
    </svg>
  );
}
