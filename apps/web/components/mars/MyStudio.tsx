'use client';

/**
 * 🎬 myスタジオ (D07-S005b, M-R154): the film studio on the red hill, built from the part cards {bati} picks from
 * what was said, then raised with the clapper. No picture is generated, no mana; it can change later and the
 * star map takes the same look. Until the prepared part pictures exist (M-R154 flow) it is drawn here in code.
 * The big frame on its front is left free: the lesson lays the MV over it.
 */
export type StudioLook = {
  ground: 'desert' | 'canyon' | 'city';
  time: 'day' | 'dusk' | 'night';
  building: 'box' | 'dome' | 'ship';
  neon: 'pink-blue' | 'gold' | 'green' | 'none';
  antenna: boolean;
  ball: boolean;
};
export const STUDIO_DEFAULT: StudioLook = { ground: 'canyon', time: 'dusk', building: 'box', neon: 'none', antenna: true, ball: false };

export function studioCards(l: StudioLook): string[] {
  return [
    { day: '昼', dusk: '夕焼け', night: '夜' }[l.time],
    { desert: '砂漠', canyon: '赤い峡谷', city: '画面の街' }[l.ground],
    ...(l.neon !== 'none' ? [{ 'pink-blue': 'ネオン：ピンクと青', gold: 'ネオン：金色', green: 'ネオン：緑' }[l.neon]] : []),
    { box: '四角い建物', dome: '丸い屋根', ship: '宇宙船の形' }[l.building],
    ...(l.antenna ? ['屋上にアンテナ'] : []),
    ...(l.ball ? ['ミラーボール'] : []),
  ];
}

/** What was said → the parts (a fixed table of words; unmatched words leave the studio as it is). */
export function studioFromWords(said: string, base: StudioLook = STUDIO_DEFAULT): StudioLook {
  const has = (...w: string[]) => w.some((x) => said.includes(x));
  const l = { ...base };
  if (has('夜', 'よる', '星')) l.time = 'night';
  else if (has('夕', 'ゆう')) l.time = 'dusk';
  else if (has('昼', 'ひる', '朝', 'あさ', '青空')) l.time = 'day';
  if (has('砂漠', 'さばく', '砂')) l.ground = 'desert';
  else if (has('峡谷', 'きょうこく', '崖', '岩')) l.ground = 'canyon';
  else if (has('街', 'まち', '都会', 'ビル')) l.ground = 'city';
  if (has('ピンク', '青', 'あお')) l.neon = 'pink-blue';
  else if (has('金', 'きん', 'ゴールド')) l.neon = 'gold';
  else if (has('緑', 'みどり')) l.neon = 'green';
  else if (has('ネオン', 'ギラギラ', 'ぎらぎら', '光')) l.neon = l.neon === 'none' ? 'pink-blue' : l.neon;
  if (has('派手', 'はで', 'パーティ', 'ミラーボール', 'クラブ')) {
    l.ball = true;
    if (l.neon === 'none') l.neon = 'pink-blue';
  }
  if (has('宇宙船', 'UFO', 'ユーフォー', 'ロケット')) l.building = 'ship';
  else if (has('丸', 'まる', 'ドーム')) l.building = 'dome';
  else if (has('四角', 'しかく', '箱')) l.building = 'box';
  if (has('アンテナなし', 'アンテナはいらない')) l.antenna = false;
  else if (has('アンテナ')) l.antenna = true;
  if (has('地味', 'じみ', 'シンプル', '静か')) {
    l.neon = 'none';
    l.ball = false;
  }
  return l;
}

export function studioOmakase(): StudioLook {
  const h = new Date().getHours();
  return { ...STUDIO_DEFAULT, time: h >= 19 || h < 5 ? 'night' : h >= 16 ? 'dusk' : 'day', neon: h >= 19 || h < 5 ? 'pink-blue' : 'none' };
}

const SKY: Record<StudioLook['time'], [string, string]> = { day: ['#ffb27a', '#ffd9a8'], dusk: ['#c2507a', '#ff9e6b'], night: ['#120d2e', '#3b1f5a'] };
const GROUND: Record<StudioLook['ground'], string> = { desert: '#d9a25f', canyon: '#b84a2e', city: '#3a3550' };
const NEON: Record<StudioLook['neon'], [string, string]> = { 'pink-blue': ['#ff5fd2', '#5fc8ff'], gold: ['#ffd36f', '#ffb347'], green: ['#6fffa8', '#3ad1a0'], none: ['transparent', 'transparent'] };

export function MyStudio({ look, built = 1, width = 300 }: { look: StudioLook; built?: number; width?: number }) {
  const [s1, s2] = SKY[look.time];
  const [n1, n2] = NEON[look.neon];
  const up = Math.min(1, built);
  const glow = look.neon !== 'none' && built >= 1;
  return (
    <svg viewBox="0 0 240 170" width={width} height={(width * 170) / 240} className="overflow-hidden rounded-2xl" role="img" aria-label="myスタジオ">
      <defs>
        <linearGradient id="stSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s1} />
          <stop offset="100%" stopColor={s2} />
        </linearGradient>
      </defs>
      <rect width="240" height="170" fill="url(#stSky)" />
      {look.time === 'night' && [20, 60, 110, 170, 210, 140, 35].map((x, k) => <circle key={k} cx={x} cy={12 + ((k * 17) % 40)} r={1} fill="#fff" opacity={0.8} />)}
      {/* the ground */}
      {look.ground === 'canyon' && <path d="M0 110 L30 80 L55 96 L80 70 L105 100 L240 100 L240 170 L0 170Z" fill={GROUND.canyon} opacity={0.75} />}
      {look.ground === 'city' && [10, 40, 175, 205].map((x, k) => <rect key={x} x={x} y={70 + (k % 2) * 12} width={24} height={60} fill="#2a2640" stroke={glow ? n2 : '#4a4566'} strokeWidth={1} />)}
      <rect y="118" width="240" height="52" fill={GROUND[look.ground]} />
      {/* the studio rises out of the sand */}
      <g transform={`translate(0 ${(1 - up) * 70})`} opacity={0.3 + up * 0.7}>
        {look.building === 'box' && <rect x="62" y="58" width="116" height="62" rx="3" fill="#ece6dc" stroke={glow ? n1 : '#8a7f70'} strokeWidth={glow ? 3 : 1.5} />}
        {look.building === 'dome' && <path d="M60 120 L60 82 A60 40 0 0 1 180 82 L180 120Z" fill="#ece6dc" stroke={glow ? n1 : '#8a7f70'} strokeWidth={glow ? 3 : 1.5} />}
        {look.building === 'ship' && (
          <g>
            <ellipse cx="120" cy="96" rx="66" ry="26" fill="#cfd6e0" stroke={glow ? n1 : '#6a7480'} strokeWidth={glow ? 3 : 1.5} />
            <ellipse cx="120" cy="80" rx="30" ry="16" fill="#9fd8ff" opacity={0.7} />
            <rect x="110" y="118" width="20" height="4" fill="#6a7480" />
          </g>
        )}
        {/* the sign */}
        <rect x="92" y="62" width="56" height="10" rx="2" fill={glow ? n2 : '#5a4f44'} opacity={glow ? 0.85 : 1} />
        <text x="120" y="70" textAnchor="middle" fontSize="7" fontWeight={800} fill="#fff">
          STUDIO
        </text>
        {look.antenna && (
          <g>
            <line x1="160" y1={look.building === 'ship' ? 70 : 58} x2="160" y2="34" stroke="#6a6a6a" strokeWidth="1.5" />
            <circle cx="160" cy="33" r="2.5" fill={glow ? n1 : '#e5484d'} />
          </g>
        )}
        {look.ball && (
          <g>
            <line x1="84" y1="58" x2="84" y2="44" stroke="#bbb" strokeWidth="1" />
            <circle cx="84" cy="40" r="6" fill="#e8e8f0" stroke="#9aa" />
            <circle cx="82" cy="38" r="1.6" fill="#fff" />
          </g>
        )}
      </g>
    </svg>
  );
}
