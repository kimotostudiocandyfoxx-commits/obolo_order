'use client';

import type { StickerMade } from '@/lib/onboarding/made';

/**
 * 🎨 myアトリエ (M-R156/M-R157): a round dome of hexagonal wooden boards and glass — the same shape as the fest
 * tents — with a hexagon-framed glass door, a wooden deck in front and the world tree seen through the glass.
 * The arts hang in frames on the wall inside. Built from part cards {bati} picks from what was said (M-R154):
 * no picture is generated, no mana, it changes at once and can be changed later. Until the prepared part
 * pictures exist (design/…, M-R154 flow), the parts are drawn here in code. `built` (0‥1) raises the boards one
 * by one from the door outwards, like a tree growing.
 */
export type AtelierLook = {
  wood: 'natural' | 'amber' | 'white' | 'dark';
  glass: 'clear' | 'blue' | 'pink' | 'amber';
  light: 'lamp' | 'skylight' | 'neon' | 'candle';
  time: 'day' | 'dusk' | 'night';
  deck: boolean;
  ball: boolean;
  /** the sign at the entrance (8 characters at most, may be empty) */
  sign: string;
};

export const ATELIER_DEFAULT: AtelierLook = {
  wood: 'natural',
  glass: 'clear',
  light: 'lamp',
  time: 'day',
  deck: true,
  ball: false,
  sign: '',
};

const WOOD: Record<AtelierLook['wood'], [string, string]> = {
  natural: ['#c99a62', '#8a6236'],
  amber: ['#d48a3a', '#8f5418'],
  white: ['#efe6d6', '#b3a58c'],
  dark: ['#6b4a32', '#3b2618'],
};
const GLASS: Record<AtelierLook['glass'], string> = {
  clear: '#dff4ff',
  blue: '#8fc8ff',
  pink: '#ffb3d6',
  amber: '#ffd59a',
};
const GLOW: Record<AtelierLook['light'], string> = {
  lamp: '#ffcf7a',
  skylight: '#fff7d6',
  neon: '#ff6fd8',
  candle: '#ffb45e',
};

/** The part cards, as {bati} shows them (one card per part). */
export function atelierCards(l: AtelierLook): string[] {
  return [
    '六角形のドーム',
    {
      natural: '木の板',
      amber: 'あめ色の板',
      white: '白い板',
      dark: 'こげ茶の板',
    }[l.wood],
    {
      clear: 'ガラスの窓',
      blue: '青いガラス',
      pink: 'ピンクのガラス',
      amber: '琥珀のガラス',
    }[l.glass],
    ...(l.deck ? ['ウッドデッキ'] : []),
    {
      lamp: 'ランプの灯り',
      skylight: '天窓の光',
      neon: 'ネオンの灯り',
      candle: 'ろうそくの灯り',
    }[l.light],
    ...(l.time !== 'day' ? [l.time === 'night' ? '夜の森' : '夕焼けの森'] : []),
    ...(l.ball ? ['ミラーボール'] : []),
    '窓の外に世界樹',
  ];
}

/**
 * What was said → the parts (a fixed table of words; the later version asks {bati}'s word sense, M-R154).
 * Words that match nothing leave the look as it is.
 */
export function atelierFromWords(said: string, base: AtelierLook = ATELIER_DEFAULT): AtelierLook {
  const s = said.toLowerCase();
  const has = (...w: string[]) => w.some((x) => s.includes(x));
  const l = { ...base };
  if (has('明る', 'あかる', '光', 'ひかり', '日差し', '天窓')) l.light = 'skylight';
  if (has('ネオン', '派手', 'はで', 'パーティ', 'クラブ', 'ギラ')) {
    l.light = 'neon';
    l.ball = true;
  }
  if (has('ろうそく', 'キャンドル', '静か', 'しずか', '落ち着')) l.light = 'candle';
  if (has('ランプ', 'あったか', '暖か', 'あたたか')) l.light = 'lamp';
  if (has('ミラーボール')) l.ball = true;
  if (has('夜', 'よる', '星', 'ほし', '月')) l.time = 'night';
  else if (has('夕', 'ゆう', 'オレンジ')) l.time = 'dusk';
  else if (has('朝', 'あさ', '昼', 'ひる')) l.time = 'day';
  if (has('ピンク', 'かわいい', '可愛', '桜', 'さくら')) l.glass = 'pink';
  else if (has('青', 'あお', '水色', '海', 'ブルー')) l.glass = 'blue';
  else if (has('琥珀', 'こはく', '黄色', 'きいろ')) l.glass = 'amber';
  else if (has('透明', 'とうめい', 'すきとお')) l.glass = 'clear';
  if (has('白', 'しろ', 'ホワイト')) l.wood = 'white';
  else if (has('黒', 'くろ', 'こげ', 'ダーク', '渋', 'しぶ')) l.wood = 'dark';
  else if (has('金', 'きん', 'あめ', '飴', 'はちみつ', '蜂蜜')) l.wood = 'amber';
  else if (has('木', 'ナチュラル', '自然')) l.wood = 'natural';
  if (has('デッキなし', 'デッキはいらない', 'デッキいらない')) l.deck = false;
  else if (has('デッキ', 'テラス')) l.deck = true;
  return l;
}

/** おまかせ: the hour sets the time of day; the rest stays the warm default. */
export function atelierOmakase(): AtelierLook {
  const h = new Date().getHours();
  return {
    ...ATELIER_DEFAULT,
    time: h >= 19 || h < 5 ? 'night' : h >= 16 ? 'dusk' : 'day',
    light: h >= 19 || h < 5 ? 'lamp' : 'skylight',
  };
}

// the dome's boards: a hexagon grid clipped to a half circle, ordered from the door outwards
const CX = 120;
const BASE = 188;
const R = 86;
const HR = 8.5;
type Hex = { x: number; y: number; glass: boolean; k: number };
const HEXES: Hex[] = (() => {
  const out: Omit<Hex, 'k'>[] = [];
  const w = Math.sqrt(3) * HR;
  for (let row = 0; row < 14; row++) {
    const y = BASE - HR * 0.4 - row * HR * 1.5;
    for (let col = -12; col <= 12; col++) {
      const x = CX + col * w + (row % 2 ? w / 2 : 0);
      // boards along the rim are cut by the dome's outline (clipPath), so the dome stays round
      if (Math.hypot(x - CX, (y - BASE) / 0.93) > R + HR) continue;
      // the door's place stays open
      if (Math.abs(x - CX) < 22 && y > BASE - 44) continue;
      out.push({ x, y, glass: (row + col * 2 + 99) % 3 !== 0 });
    }
  }
  return out.sort((a, b) => Math.hypot(a.x - CX, a.y - BASE) - Math.hypot(b.x - CX, b.y - BASE)).map((h, k) => ({ ...h, k }));
})();
const hexPath = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

export function MyAtelier({ look, built = 1, arts = [], width = 260, onArt }: { look: AtelierLook; built?: number; arts?: StickerMade[]; width?: number; onArt?: () => void }) {
  const [wood, woodDark] = WOOD[look.wood];
  const glass = GLASS[look.glass];
  const glow = GLOW[look.light];
  const shown = Math.round(built * HEXES.length);
  const door = built > 0;
  const lit = built >= 1;
  // the tree's leaves take the time of day's colour
  const sky = look.time === 'night' ? '#1d4a3a' : look.time === 'dusk' ? '#7a7a3e' : null;
  return (
    <svg viewBox="0 0 240 230" width={width} height={(width * 230) / 240} className="overflow-visible" role="img" aria-label="myアトリエ">
      <defs>
        <radialGradient id="atGlow" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor={glow} stopOpacity={lit ? (look.time === 'day' ? 0.55 : 0.9) : 0} />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <clipPath id="atDome">
          <path d={`M${CX - R} ${BASE} A ${R} ${R * 0.93} 0 0 1 ${CX + R} ${BASE} Z`} />
        </clipPath>
      </defs>
      {/* the world tree, far behind the dome (seen through the glass) */}
      <g opacity={0.8} transform={`translate(${CX + 30} 40) scale(0.85) translate(${-CX - 30} -40)`}>
        <rect x={CX + 18} y={40} width={16} height={150} rx={6} fill="#6b4a2a" />
        {[
          [CX + 26, 40, 46],
          [CX - 4, 62, 34],
          [CX + 58, 66, 34],
          [CX + 26, 14, 30],
        ].map(([x, y, r], k) => (
          <circle key={k} cx={x} cy={y} r={r} fill={sky ?? '#4f9a5c'} opacity={0.95 - k * 0.08} />
        ))}
      </g>
      {/* inside: the light and the frames on the back wall */}
      <path d={`M${CX - R} ${BASE} A ${R} ${R * 0.93} 0 0 1 ${CX + R} ${BASE} Z`} fill="#2b1d14" opacity={built > 0 ? 0.55 : 0} />
      <path d={`M${CX - R} ${BASE} A ${R} ${R * 0.93} 0 0 1 ${CX + R} ${BASE} Z`} fill="url(#atGlow)" />
      {lit &&
        arts.slice(0, 4).map((a, k) => (
          <g key={k} onClick={onArt} style={{ cursor: onArt ? 'pointer' : undefined }}>
            <rect x={CX - 66 + k * 34} y={124 - (k % 2) * 8} width={26} height={26} fill="#d9b25a" />
            {a.url ? (
              <image href={a.url} x={CX - 64 + k * 34} y={126 - (k % 2) * 8} width={22} height={22} preserveAspectRatio="xMidYMid slice" />
            ) : (
              <rect x={CX - 64 + k * 34} y={126 - (k % 2) * 8} width={22} height={22} fill="#f3e6c8" />
            )}
          </g>
        ))}
      {look.ball && lit && (
        <g>
          <line x1={CX} y1={BASE - R * 0.9} x2={CX} y2={BASE - R * 0.62} stroke="#ccc" strokeWidth={1} />
          <circle cx={CX} cy={BASE - R * 0.55} r={8} fill="#e8e8f0" stroke="#9aa" strokeWidth={1} />
          <circle cx={CX - 3} cy={BASE - R * 0.58} r={2} fill="#fff" />
        </g>
      )}
      {/* the boards and the glass, one by one */}
      <g clipPath="url(#atDome)">
        {HEXES.slice(0, shown).map((h) => (
          <polygon
            key={h.k}
            points={hexPath(h.x, h.y, HR - 0.8)}
            fill={h.glass ? glass : wood}
            fillOpacity={h.glass ? 0.32 : 1}
            stroke={look.light === 'neon' && lit ? '#ff8ae6' : woodDark}
            strokeWidth={1.4}
            style={{
              animation: built < 1 ? 'atPop 0.35s ease-out' : undefined,
            }}
          />
        ))}
      </g>
      {built >= 1 && <path d={`M${CX - R} ${BASE} A ${R} ${R * 0.93} 0 0 1 ${CX + R} ${BASE}`} fill="none" stroke={woodDark} strokeWidth={3} />}
      {/* the hexagon-framed glass door */}
      {door && (
        <g>
          <polygon points={hexPath(CX, BASE - 22, 21)} fill={glass} fillOpacity={0.4} stroke={woodDark} strokeWidth={3} />
          <line x1={CX} y1={BASE - 42} x2={CX} y2={BASE - 2} stroke={woodDark} strokeWidth={2} />
          <circle cx={CX + 6} cy={BASE - 20} r={1.8} fill="#e9c46a" />
        </g>
      )}
      {/* the deck */}
      {look.deck && built > 0.3 && (
        <g>
          <path d={`M${CX - 70} ${BASE} L${CX + 70} ${BASE} L${CX + 84} ${BASE + 22} L${CX - 84} ${BASE + 22} Z`} fill={wood} stroke={woodDark} strokeWidth={1.5} />
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={CX - 72 - k * 3.5} y1={BASE + 5 + k * 5} x2={CX + 72 + k * 3.5} y2={BASE + 5 + k * 5} stroke={woodDark} strokeWidth={0.8} opacity={0.7} />
          ))}
        </g>
      )}
      {!look.deck && <ellipse cx={CX} cy={BASE + 6} rx={92} ry={9} fill="#5b3a22" opacity={0.55} />}
      {/* the sign at the entrance */}
      {look.sign && built >= 1 && (
        <g>
          <rect x={CX - 112} y={BASE - 14} width={4} height={34} fill={woodDark} />
          <rect x={CX - 128} y={BASE - 30} width={58} height={18} rx={3} fill="#f6ead2" stroke={woodDark} strokeWidth={1.5} />
          <text x={CX - 99} y={BASE - 17.5} textAnchor="middle" fontSize={look.sign.length > 6 ? 7 : 8.5} fontWeight={700} fill="#5a3d22">
            {look.sign}
          </text>
        </g>
      )}
      <style>{'@keyframes atPop{from{opacity:0;transform:scale(.6);transform-origin:center}to{opacity:1}}'}</style>
    </svg>
  );
}
