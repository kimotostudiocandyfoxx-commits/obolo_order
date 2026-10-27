'use client';

/**
 * 🏝️ myアイランド (story D06-S007b, draft 21): your island off the harbour — a shape, a beach and a light
 * (none picked = おまかせ), an optional name, a small pier on every island for the ships coming home, and
 * the records of your songs standing on the beach. Drawn in code, so it can rise out of the sea.
 */
export type IslandLook = { shape: 'hill' | 'moon' | 'twin'; beach: 'sand' | 'shell' | 'black' | 'coral'; light: 'lighthouse' | 'lantern' | 'rock' | 'none'; name: string };
export const ISLAND_SHAPES: { v: IslandLook['shape']; label: string }[] = [
  { v: 'hill', label: '丸い丘' },
  { v: 'moon', label: '三日月' },
  { v: 'twin', label: 'ふたこぶ' },
];
export const ISLAND_BEACHES: { v: IslandLook['beach']; label: string; c: string }[] = [
  { v: 'sand', label: '白い砂', c: '#f4ead2' },
  { v: 'shell', label: '貝がら', c: '#f7d9d0' },
  { v: 'black', label: '黒い石', c: '#3b3b44' },
  { v: 'coral', label: 'さんご', c: '#ff9e8a' },
];
export const ISLAND_LIGHTS: { v: IslandLook['light']; label: string }[] = [
  { v: 'lighthouse', label: '灯台' },
  { v: 'lantern', label: 'ランタンの木' },
  { v: 'rock', label: '光る岩' },
  { v: 'none', label: '灯りなし' },
];
/** おまかせ: one of each, from the name (or a coin) */
export function islandOmakase(seed: string): IslandLook {
  const h = [...(seed || 'island')].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 11);
  return { shape: ISLAND_SHAPES[h % 3].v, beach: ISLAND_BEACHES[(h >>> 3) % 4].v, light: ISLAND_LIGHTS[(h >>> 6) % 3].v, name: '' };
}

/** rise: 0 under the sea → 1 rising (water falling off its edges) → 2 up, the light on */
export function MyIsland({ look, rise = 2, records = 0, width = 300 }: { look: IslandLook; rise?: 0 | 1 | 2; records?: number; width?: number }) {
  const beach = ISLAND_BEACHES.find((b) => b.v === look.beach)!.c;
  const y = rise === 0 ? 40 : rise === 1 ? 14 : 0;
  const lit = rise === 2;
  return (
    <div className="relative" style={{ width, height: width * 0.62 }}>
      <svg viewBox="0 0 100 62" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="isl-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fd694" />
            <stop offset="100%" stopColor="#3f8f5a" />
          </linearGradient>
          <clipPath id="isl-sea">
            <rect x="-20" y="-40" width="140" height="88" />
          </clipPath>
        </defs>
        {lit && look.light === 'none' && <circle cx="50" cy="-6" r="2.4" fill="#fff8d0" className="animate-pulse" />}
        <g clipPath="url(#isl-sea)" style={{ transform: `translateY(${y}px)`, transition: 'transform 2.2s cubic-bezier(.2,.8,.2,1)' }}>
          {/* the beach ring, then the land */}
          <ellipse cx="50" cy="46" rx="44" ry="9" fill={beach} />
          {look.shape === 'hill' && <path d="M14 46 C22 22 40 12 50 12 C60 12 78 22 86 46Z" fill="url(#isl-green)" />}
          {look.shape === 'moon' && <path d="M12 46 C18 30 30 22 42 24 C34 30 34 40 44 46Z M56 46 C66 40 66 30 58 24 C70 22 82 30 88 46Z" fill="url(#isl-green)" />}
          {look.shape === 'twin' && <path d="M12 46 C18 26 28 16 36 16 C44 16 48 30 50 32 C52 30 56 18 64 18 C72 18 82 28 88 46Z" fill="url(#isl-green)" />}
          {/* the small pier every island has */}
          <rect x="74" y="44" width="16" height="2" fill="#8a5a36" />
          <rect x="88" y="44" width="1.4" height="6" fill="#6b4428" />
          {/* the light */}
          {look.light === 'lighthouse' && (
            <g>
              <path d="M47 14 L53 14 L54.5 28 L45.5 28Z" fill="#f4f4f5" stroke="#c0392b" strokeWidth="0.6" />
              <rect x="46.5" y="10" width="7" height="4" fill="#2d2d38" />
              {lit && <path d="M53 12 L80 6 L80 18Z" fill="#fff3b0" opacity="0.55" className="animate-pulse" />}
            </g>
          )}
          {look.light === 'lantern' && (
            <g>
              <path d="M50 30 L50 16" stroke="#6b4428" strokeWidth="1.6" />
              <circle cx="50" cy="14" r="7" fill="#4f9a5a" />
              {[44, 50, 56].map((x) => (
                <circle key={x} cx={x} cy={x === 50 ? 10 : 15} r="1.4" fill={lit ? '#ffd56b' : '#7a6a3a'} />
              ))}
            </g>
          )}
          {look.light === 'rock' && <ellipse cx="50" cy="22" rx="6" ry="4.5" fill={lit ? '#9ff0ff' : '#6b7a80'} className={lit ? 'animate-pulse' : ''} />}
          {/* the records of your songs, standing on the beach */}
          {Array.from({ length: Math.min(records, 3) }, (_, k) => (
            <g key={k}>
              <circle cx={24 + k * 7} cy="44" r="3.2" fill="#111" />
              <circle cx={24 + k * 7} cy="44" r="1.1" fill="#e5484d" />
            </g>
          ))}
        </g>
        {rise === 1 && (
          <g fill="#bfe9ff" opacity="0.8">
            <rect x="10" y="40" width="1" height="8" className="animate-pulse" />
            <rect x="88" y="40" width="1" height="8" className="animate-pulse" />
          </g>
        )}
        <path d="M-10 50 Q10 48 30 50 T70 50 T110 50 L110 62 L-10 62Z" fill="#2a7fbf" opacity="0.55" />
      </svg>
      {lit && look.name && <span className="absolute left-1/2 top-[86%] -translate-x-1/2 rounded bg-white/85 px-2 py-0.5 text-[12px] font-bold text-sky-800 shadow">{look.name}</span>}
    </div>
  );
}
