/**
 * ぷにぷに parts box (prototype). Every part is drawn in code (SVG) in a box where the body's
 * radius is 100, and is placed with the anchors of the body shape (top of the head, face, sides,
 * belly, bottom), so the same part fits every body and squashes / rolls with it.
 * A look = body shape + colour + texture + one part per slot. Saved as ids only.
 */
import type { ReactNode } from 'react';
import type { PuniLook } from '@obolo/shared';
import type { BodyShape } from './physics';

export type Texture = PuniLook['tex'];
export type FaceKind = PuniLook['face'];
export type Eyes = PuniLook['eyes'];
export type Mouth = PuniLook['mouth'];
export type Hat = PuniLook['hat'];
export type Glasses = PuniLook['glasses'];
export type Neck = PuniLook['neck'];
export type Wear = PuniLook['wear'];
export type Hands = PuniLook['hands'];
export type Item = PuniLook['item'];
export type Effect = PuniLook['effect'];

/** A look with a name (the samples / the wardrobe); members store the PuniLook part only. */
export interface Look extends PuniLook {
  id: string;
  name: string;
}

/** A plain starting look from the member's NEO colour. */
export function defaultLook(color = '#f4a3c4'): PuniLook {
  return { shape: 'round', color, tex: 'none', face: 'normal', eyes: 'sparkle', mouth: 'cat', hat: 'none', glasses: 'none', neck: 'none', wear: 'none', hands: 'none', item: 'star', effect: 'sparkle' };
}

/** The five characters from the client's reference pictures (2026-10-07). */
export const SAMPLE_LOOKS: Look[] = [
  { id: 'onigiri', name: 'おにぎりくん', shape: 'tall', color: '#f6f1e4', tex: 'rice', face: 'normal', eyes: 'sparkle', mouth: 'cat', hat: 'none', glasses: 'none', neck: 'none', wear: 'nori', hands: 'peace', item: 'none', effect: 'sparkle' },
  { id: 'gorilla5454', name: 'ゴリラ 5454', shape: 'chunky', color: '#3b3433', tex: 'fur', face: 'gorilla', eyes: 'sparkle', mouth: 'cat', hat: 'none', glasses: 'roundDark', neck: 'goldChain', wear: 'shorts', hands: 'robot', item: 'banana', effect: 'zap', medal: '5454' },
  { id: 'queen', name: 'ワニの女王', shape: 'round', color: '#5e8a4b', tex: 'scales', face: 'croc', eyes: 'sparkle', mouth: 'none', hat: 'crown', glasses: 'none', neck: 'queenCollar', wear: 'dress', hands: 'fan', item: 'none', effect: 'hearts' },
  { id: 'hippo', name: 'カバの紳士', shape: 'chunky', color: '#5a5461', tex: 'none', face: 'hippo', eyes: 'glow', mouth: 'none', hat: 'none', glasses: 'none', neck: 'none', wear: 'suit', hands: 'none', item: 'none', effect: 'zap' },
  { id: 'gorilla4545', name: 'ゴリラ 4545', shape: 'round', color: '#3a3332', tex: 'fur', face: 'gorilla', eyes: 'sparkle', mouth: 'roar', hat: 'bucket', glasses: 'roundYellow', neck: 'goldChain', wear: 'none', hands: 'spray', item: 'none', effect: 'puff', medal: '4545' },
];

/** The choices per slot, for the wardrobe (label shown to the visitor). */
export const SLOTS = {
  shape: [['round', 'まる'], ['tall', 'たて長'], ['chunky', 'どっしり']],
  tex: [['none', 'つるつる'], ['rice', 'お米'], ['fur', 'けがわ'], ['scales', 'うろこ'], ['salmon', 'サーモン'], ['sesame', 'ごま']],
  face: [['normal', 'ふつう'], ['gorilla', 'ゴリラ'], ['croc', 'ワニ'], ['hippo', 'カバ']],
  eyes: [['sparkle', 'キラキラ'], ['glow', '光る目']],
  mouth: [['smile', 'にっこり'], ['roar', 'ガオー'], ['cat', 'ω'], ['none', 'なし']],
  hat: [['none', 'なし'], ['bucket', 'バケハ'], ['crown', '王冠']],
  glasses: [['none', 'なし'], ['roundDark', '丸サングラス'], ['roundYellow', '黄色メガネ']],
  neck: [['none', 'なし'], ['goldChain', '金チェーン'], ['queenCollar', '女王のえり']],
  wear: [['none', 'なし'], ['nori', 'のり'], ['suit', 'スーツ'], ['dress', 'ドレス'], ['shorts', '短パン']],
  hands: [['none', 'なし'], ['peace', 'ピース'], ['robot', 'ロボ腕'], ['fan', '扇子'], ['spray', 'スプレー']],
  item: [['none', 'なし'], ['banana', 'バナナ'], ['star', 'キラ星']],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export const SLOT_LABELS: Record<keyof typeof SLOTS, string> = {
  shape: '体の形',
  tex: '体の質感',
  face: '顔',
  eyes: '目',
  mouth: '口',
  hat: '帽子',
  glasses: 'メガネ',
  neck: '首',
  wear: '服',
  hands: '手',
  item: '口もと',
};

export const COLORS = ['#f6f1e4', '#3b3433', '#6f7378', '#5e8a4b', '#5a5461', '#e5544b', '#ff8a6b', '#f4a3c4', '#8ec5ff', '#ffd36b', '#9c7be0', '#9be3b0'];

/** Where things go on each body (box: radius 100). */
export function anchors(shape: BodyShape) {
  switch (shape) {
    case 'tall':
      return { top: -104, face: -6, side: 84, belly: 40, bottom: 116 };
    case 'chunky':
      return { top: -84, face: 4, side: 108, belly: 46, bottom: 102 };
    default:
      return { top: -98, face: 2, side: 98, belly: 44, bottom: 98 };
  }
}

type A = ReturnType<typeof anchors>;

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110;
};

// --- textures (px patterns in the body's own frame; R = body radius in px) --------------------

export function TextureDefs({ id, tex, color, R }: { id: string; tex: Texture; color: string; R: number }) {
  const s = R / 70;
  if (tex === 'rice')
    return (
      <pattern id={id} width={13 * s} height={9 * s} patternUnits="userSpaceOnUse">
        <ellipse cx={3.5 * s} cy={2.5 * s} rx={3.2 * s} ry={2.1 * s} fill="#fffdf7" stroke="#d9cfb8" strokeWidth={0.7 * s} />
        <ellipse cx={10 * s} cy={7 * s} rx={3.2 * s} ry={2.1 * s} fill="#fffdf7" stroke="#d9cfb8" strokeWidth={0.7 * s} />
      </pattern>
    );
  if (tex === 'fur')
    return (
      <pattern id={id} width={9 * s} height={9 * s} patternUnits="userSpaceOnUse">
        <path d={`M${1 * s},${3 * s} l${2 * s},${2.5 * s} M${5 * s},${1 * s} l${2 * s},${2.6 * s} M${3 * s},${6 * s} l${2 * s},${2.6 * s}`} stroke={shade(color, 0.22)} strokeWidth={0.9 * s} strokeLinecap="round" />
        <path d={`M${6.5 * s},${5.5 * s} l${1.6 * s},${2.2 * s}`} stroke={shade(color, -0.45)} strokeWidth={0.9 * s} strokeLinecap="round" />
      </pattern>
    );
  if (tex === 'scales')
    return (
      <pattern id={id} width={12 * s} height={9 * s} patternUnits="userSpaceOnUse">
        <path d={`M0,${9 * s} a${6 * s},${6 * s} 0 0 1 ${12 * s},0 M${-6 * s},${4.5 * s} a${6 * s},${6 * s} 0 0 1 ${12 * s},0 M${6 * s},${4.5 * s} a${6 * s},${6 * s} 0 0 1 ${12 * s},0`} fill="none" stroke={shade(color, -0.3)} strokeWidth={0.9 * s} />
      </pattern>
    );
  if (tex === 'salmon')
    return (
      <pattern id={id} width={60 * s} height={26 * s} patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <path d={`M0,${13 * s} q${15 * s},${-9 * s} ${30 * s},0 t${30 * s},0`} fill="none" stroke="#fff4ec" strokeWidth={5 * s} strokeLinecap="round" opacity={0.9} />
      </pattern>
    );
  if (tex === 'sesame')
    return (
      <pattern id={id} width={16 * s} height={14 * s} patternUnits="userSpaceOnUse">
        <ellipse cx={4 * s} cy={4 * s} rx={1.6 * s} ry={2.6 * s} fill="#f5c84a" transform={`rotate(25 ${4 * s} ${4 * s})`} />
        <ellipse cx={12 * s} cy={11 * s} rx={1.6 * s} ry={2.6 * s} fill="#f5c84a" transform={`rotate(-30 ${12 * s} ${11 * s})`} />
      </pattern>
    );
  return null;
}

/**
 * The glossy "mochi" skin (client's reference picture): soft gradient body, a light rim at the
 * lower edge, a big blurred highlight and a sharp shine dot top-left, a soft (not black) outline.
 * `uid` keeps the gradient / filter ids unique per figure.
 */
export function SkinDefs({ uid, color, R }: { uid: string; color: string; R: number }) {
  return (
    <>
      <radialGradient id={`pg${uid}`} cx=".38" cy=".32" r=".78">
        <stop offset="0" stopColor={shade(color, 0.32)} />
        <stop offset=".55" stopColor={color} />
        <stop offset="1" stopColor={shade(color, -0.32)} />
      </radialGradient>
      <filter id={`pb${uid}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={R * 0.07} />
      </filter>
    </>
  );
}

/** Rim light (needs the body clip) — drawn over the body / texture / clothes. */
export function SkinRim({ uid, clip, color, R }: { uid: string; clip: string; color: string; R: number }) {
  return (
    <g clipPath={`url(#${clip})`}>
      <ellipse cx={R * 0.1} cy={R * 0.16} rx={R * 1.02} ry={R * 1.02} fill="none" stroke={shade(color, 0.55)} strokeWidth={R * 0.1} opacity={0.45} filter={`url(#pb${uid})`} />
    </g>
  );
}

/** The highlight: stays top-left whatever the body does (the stage counter-rotates it). */
export function SkinGloss({ uid, R }: { uid: string; R: number }) {
  return (
    <>
      <ellipse cx={-R * 0.36} cy={-R * 0.5} rx={R * 0.36} ry={R * 0.2} fill="#fff" opacity={0.75} transform={`rotate(-28 ${-R * 0.36} ${-R * 0.5})`} filter={`url(#pb${uid})`} />
      <ellipse cx={-R * 0.48} cy={-R * 0.56} rx={R * 0.09} ry={R * 0.06} fill="#fff" opacity={0.95} transform={`rotate(-28 ${-R * 0.48} ${-R * 0.56})`} />
    </>
  );
}

export const skinStroke = (color: string) => shade(color, -0.4);

// --- parts ----------------------------------------------------------------------------------------

/** Behind the body: ears, the queen's collar back, the nori tails. */
export function BackParts({ look: l, a }: { look: PuniLook; a: A }) {
  const out: ReactNode[] = [];
  const limb = shade(l.color, -0.18);
  out.push(
    <g key="feet">
      <ellipse cx={-34} cy={a.bottom - 6} rx={20} ry={14} fill={limb} />
      <ellipse cx={34} cy={a.bottom - 6} rx={20} ry={14} fill={limb} />
    </g>,
  );
  if (l.hands === 'none')
    out.push(
      <g key="arms">
        <ellipse cx={-a.side * 0.98} cy={a.belly - 4} rx={16} ry={12} fill={limb} transform={`rotate(-25 ${-a.side * 0.98} ${a.belly - 4})`} />
        <ellipse cx={a.side * 0.98} cy={a.belly - 4} rx={16} ry={12} fill={limb} transform={`rotate(25 ${a.side * 0.98} ${a.belly - 4})`} />
      </g>,
    );
  if (l.face === 'gorilla')
    out.push(
      <g key="ears">
        <circle cx={-a.side * 0.9} cy={a.face - 6} r={15} fill={shade(l.color, -0.2)} />
        <circle cx={a.side * 0.9} cy={a.face - 6} r={15} fill={shade(l.color, -0.2)} />
        <circle cx={-a.side * 0.9} cy={a.face - 6} r={8} fill={shade(l.color, 0.25)} />
        <circle cx={a.side * 0.9} cy={a.face - 6} r={8} fill={shade(l.color, 0.25)} />
      </g>,
    );
  if (l.face === 'hippo')
    out.push(
      <g key="ears">
        <ellipse cx={-48} cy={a.top + 8} rx={13} ry={16} fill={shade(l.color, -0.15)} transform={`rotate(-20 -48 ${a.top + 8})`} />
        <ellipse cx={48} cy={a.top + 8} rx={13} ry={16} fill={shade(l.color, -0.15)} transform={`rotate(20 48 ${a.top + 8})`} />
        <ellipse cx={-48} cy={a.top + 9} rx={6} ry={8} fill="#d99aa5" transform={`rotate(-20 -48 ${a.top + 9})`} />
        <ellipse cx={48} cy={a.top + 9} rx={6} ry={8} fill="#d99aa5" transform={`rotate(20 48 ${a.top + 9})`} />
      </g>,
    );
  if (l.face === 'croc')
    out.push(
      <g key="eyebumps">
        <circle cx={-30} cy={a.top + 6} r={18} fill={l.color} />
        <circle cx={30} cy={a.top + 6} r={18} fill={l.color} />
      </g>,
    );
  if (l.neck === 'queenCollar')
    out.push(<path key="collar" d={`M${-a.side * 0.95},${a.face + 10} Q${-a.side * 1.1},${a.face - 50} ${-a.side * 0.55},${a.face - 40} L${a.side * 0.55},${a.face - 40} Q${a.side * 1.1},${a.face - 50} ${a.side * 0.95},${a.face + 10}Z`} fill="#6a1f3d" stroke="#d8a944" strokeWidth={3} />);
  return <>{out}</>;
}

/** Clothes: clipped to the body so they wrap it. */
export function WearPart({ look: l, a }: { look: PuniLook; a: A }) {
  switch (l.wear) {
    case 'nori':
      return (
        <g>
          <rect x={-140} y={a.belly - 26} width={280} height={44} fill="#262a22" />
          {Array.from({ length: 18 }, (_, i) => (
            <path key={i} d={`M${-130 + i * 15},${a.belly - 26} l6,44`} stroke="#3a4033" strokeWidth={2} />
          ))}
        </g>
      );
    case 'suit':
      return (
        <g>
          <rect x={-140} y={a.face + 34} width={280} height={200} fill="#23212a" />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M${-130 + i * 17},${a.face + 34} v200`} stroke="#3a3542" strokeWidth={1.2} />
          ))}
          <path d={`M-30,${a.face + 34} L0,${a.face + 92} L30,${a.face + 34}Z`} fill="#f4f1ea" />
          <path d={`M-30,${a.face + 34} L-6,${a.face + 96} L-46,${a.face + 60}Z M30,${a.face + 34} L6,${a.face + 96} L46,${a.face + 60}Z`} fill="#18161d" stroke="#b08a4a" strokeWidth={1.5} />
          <path d={`M-7,${a.face + 38} L7,${a.face + 38} L5,${a.face + 48} L9,${a.face + 84} L0,${a.face + 94} L-9,${a.face + 84} L-5,${a.face + 48}Z`} fill="#8e1f33" />
          <path d={`M44,${a.face + 64} l18,-3 l-2,8 l-16,2z`} fill="#8e1f33" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={-14} cy={a.face + 110 + i * 14} r={3} fill="#b08a4a" />
          ))}
        </g>
      );
    case 'dress':
      return (
        <g>
          <rect x={-140} y={a.face + 40} width={280} height={200} fill="#6a1f3d" />
          <path d={`M-140,${a.face + 40} H140`} stroke="#d8a944" strokeWidth={5} />
          <path d={`M-22,${a.face + 40} L0,${a.face + 160} L22,${a.face + 40}Z`} fill="#c89a55" />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={-90 + i * 20} cy={a.face + 70 + (i % 2) * 18} r={3.2} fill="#d8a944" />
          ))}
          <circle cx={0} cy={a.face + 62} r={6} fill="#c86ab0" stroke="#d8a944" strokeWidth={2} />
        </g>
      );
    case 'shorts':
      return (
        <g>
          <rect x={-140} y={a.bottom - 50} width={280} height={80} fill="#1b1b1d" />
          <path d={`M-140,${a.bottom - 48} H140`} stroke="#4a4a50" strokeWidth={3} />
          <path d={`M0,${a.bottom - 48} V${a.bottom}`} stroke="#4a4a50" strokeWidth={2} />
          <circle cx={0} cy={a.bottom - 42} r={3} fill="#b08a4a" />
        </g>
      );
    default:
      return null;
  }
}

function Eye({ x, y, kind }: { x: number; y: number; kind: Eyes }) {
  if (kind === 'glow')
    return (
      <g filter="url(#puni-glow)">
        <ellipse cx={x} cy={y} rx={9} ry={6} fill="#6ff6ff" />
        <ellipse cx={x} cy={y} rx={4} ry={3} fill="#fff" />
      </g>
    );
  return (
    <g>
      <ellipse cx={x} cy={y} rx={8.5} ry={10} fill="#241a2e" />
      <ellipse cx={x} cy={y + 4} rx={6} ry={4} fill="#5b3f7a" opacity={0.55} />
      <circle cx={x + 2.6} cy={y - 3.6} r={3.6} fill="#fff" />
      <circle cx={x - 3} cy={y + 4} r={1.5} fill="#fff" opacity={0.9} />
    </g>
  );
}

/** Face: muzzle, eyes (normal + "poked" >_<, the stage switches them), mouth, cheeks. */
export function FaceParts({ look: l, a }: { look: PuniLook; a: A }) {
  const ey = a.face - (l.face === 'croc' ? 26 : l.face === 'hippo' ? 22 : l.face === 'gorilla' ? 6 : 0);
  const ex = l.face === 'normal' ? 34 : 30;
  const out: ReactNode[] = [];
  if (l.face === 'gorilla') {
    out.push(
      <g key="muzzle">
        <ellipse cx={0} cy={a.face + 6} rx={62} ry={50} fill={shade(l.color, 0.32)} />
        <path d={`M-58,${ey - 14} Q0,${ey - 34} 58,${ey - 14}`} fill="none" stroke={shade(l.color, -0.35)} strokeWidth={9} strokeLinecap="round" />
        <ellipse cx={0} cy={a.face + 30} rx={36} ry={22} fill={shade(l.color, 0.45)} />
        <ellipse cx={-9} cy={a.face + 22} rx={5} ry={3.5} fill={shade(l.color, -0.4)} />
        <ellipse cx={9} cy={a.face + 22} rx={5} ry={3.5} fill={shade(l.color, -0.4)} />
      </g>,
    );
  }
  if (l.face === 'croc') {
    out.push(
      <g key="snout">
        <rect x={-38} y={a.face - 10} width={76} height={70} rx={30} fill={shade(l.color, 0.18)} stroke={shade(l.color, -0.25)} strokeWidth={2} />
        <path d={`M-30,${a.face + 48} ${Array.from({ length: 6 }, (_, i) => `l5,8 l5,-8`).join(' ')}`} fill="#fff" stroke="#e7e2d0" strokeWidth={1} />
        <ellipse cx={-11} cy={a.face + 2} rx={4} ry={3} fill={shade(l.color, -0.45)} />
        <ellipse cx={11} cy={a.face + 2} rx={4} ry={3} fill={shade(l.color, -0.45)} />
      </g>,
    );
  }
  if (l.face === 'hippo') {
    out.push(
      <g key="muzzle">
        <ellipse cx={0} cy={a.face + 28} rx={66} ry={44} fill={shade(l.color, 0.18)} stroke={shade(l.color, -0.25)} strokeWidth={2} />
        <ellipse cx={-24} cy={a.face + 14} rx={9} ry={7} fill={shade(l.color, -0.45)} />
        <ellipse cx={24} cy={a.face + 14} rx={9} ry={7} fill={shade(l.color, -0.45)} />
        <path d={`M-40,${a.face + 46} Q0,${a.face + 58} 40,${a.face + 46}`} fill="none" stroke={shade(l.color, -0.45)} strokeWidth={3} strokeLinecap="round" />
        <path d={`M-38,${a.face + 47} l4,-12 l5,11z M38,${a.face + 47} l-4,-12 l-5,11z`} fill="#f5efe0" />
      </g>,
    );
  }
  // eyes: the normal pair and the poked pair (>_<); the stage shows one of them
  const glassesHide = l.glasses !== 'none';
  out.push(
    <g key="eyes" data-eyes="open" style={{ transformOrigin: `0px ${ey}px` }}>
      {!glassesHide && (
        <>
          <Eye x={-ex} y={ey} kind={l.eyes} />
          <Eye x={ex} y={ey} kind={l.eyes} />
        </>
      )}
    </g>,
    <g key="poked" data-eyes="poked" style={{ display: 'none' }}>
      {!glassesHide && (
        <path d={`M${-ex - 9},${ey - 8} l14,8 l-14,8 M${ex + 9},${ey - 8} l-14,8 l14,8`} fill="none" stroke={isDark(l.color) ? '#fff' : '#1d1622'} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </g>,
  );
  if (l.face !== 'croc')
    out.push(
      <g key="cheeks" opacity={0.7}>
        <ellipse cx={-ex - 14} cy={ey + 14} rx={11} ry={6.5} fill="#ff8fb0" />
        <ellipse cx={ex + 14} cy={ey + 14} rx={11} ry={6.5} fill="#ff8fb0" />
      </g>,
    );
  const my = l.face === 'gorilla' ? a.face + 40 : l.face === 'normal' ? ey + 4 : ey + 26;
  if (l.mouth === 'smile') out.push(<path key="mouth" d={`M-15,${my - 4} Q0,${my - 6} 15,${my - 4} Q13,${my + 16} 0,${my + 16} Q-13,${my + 16} -15,${my - 4}Z`} fill="#7a2a33" />, <ellipse key="tongue" cx={0} cy={my + 10} rx={8} ry={4.5} fill="#f08a98" />);
  if (l.mouth === 'roar')
    out.push(
      <g key="mouth">
        <path d={`M-24,${my - 8} Q0,${my - 14} 24,${my - 8} Q20,${my + 24} 0,${my + 24} Q-20,${my + 24} -24,${my - 8}Z`} fill="#6a1c24" />
        <ellipse cx={0} cy={my + 15} rx={12} ry={6} fill="#e57685" />
        <path d={`M-18,${my - 8} l4,10 l4,-10 M10,${my - 8} l4,10 l4,-10`} fill="#fff" />
      </g>,
    );
  if (l.mouth === 'cat') out.push(<path key="mouth" d={`M-10,${my} q5,6 10,0 q5,6 10,0`} fill="none" stroke="#2a1d33" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />);
  return <>{out}</>;
}

/** Glasses, hat, neck, hands, items: in front of everything. */
export function FrontParts({ look: l, a }: { look: PuniLook; a: A }) {
  const ey = a.face - (l.face === 'croc' ? 26 : l.face === 'hippo' ? 22 : 6);
  const out: ReactNode[] = [];
  if (l.wear === 'nori')
    out.push(<path key="tails" d={`M${a.side * 0.92},${a.belly - 6} q24,-4 44,10 q-18,2 -26,16 q-6,-14 -18,-12z M${a.side * 0.92},${a.belly + 4} q30,8 34,34 q-14,-10 -30,-8z`} fill="#262a22" stroke="#3a4033" strokeWidth={1.5} />);
  if (l.neck === 'goldChain')
    out.push(
      <g key="chain">
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${-58 + i * 6},${a.face + 30 + i * 8} Q0,${a.face + 78 + i * 12} ${58 - i * 6},${a.face + 30 + i * 8}`} fill="none" stroke="#d7a93a" strokeWidth={5} strokeDasharray="6 3" strokeLinecap="round" />
        ))}
        <circle cx={0} cy={a.face + 96} r={20} fill="#d7a93a" stroke="#8a6519" strokeWidth={2.5} />
        <text x={0} y={a.face + 101} textAnchor="middle" fontSize={13} fontWeight={900} fill="#5a3f0c" fontFamily="system-ui">
          {l.medal ?? 'OBO'}
        </text>
      </g>,
    );
  if (l.neck === 'queenCollar')
    out.push(
      <g key="pearls">
        <path d={`M-40,${a.face + 38} Q0,${a.face + 66} 40,${a.face + 38}`} fill="none" stroke="#f6eedb" strokeWidth={6} strokeDasharray="0.1 9" strokeLinecap="round" />
      </g>,
    );
  if (l.glasses !== 'none') {
    const rim = l.glasses === 'roundYellow' ? '#ffd02e' : '#c9a54a';
    out.push(
      <g key="glasses">
        <path d={`M-13,${ey} Q0,${ey - 7} 13,${ey}`} fill="none" stroke={rim} strokeWidth={3.5} />
        <circle cx={-30} cy={ey} r={18} fill="#141018" stroke={rim} strokeWidth={4} />
        <circle cx={30} cy={ey} r={18} fill="#141018" stroke={rim} strokeWidth={4} />
        <path d={`M-38,${ey - 8} l8,-4 M22,${ey - 8} l8,-4`} stroke="#fff" strokeOpacity={0.6} strokeWidth={3} strokeLinecap="round" />
      </g>,
    );
  }
  if (l.item === 'banana')
    out.push(
      <g key="banana" transform={`translate(${22},${a.face + 30}) rotate(-18) scale(1.25)`}>
        <path d="M-10,0 Q14,16 44,4 Q48,2 46,-3 Q16,6 -8,-8z" fill="#f6d24a" stroke="#8a6a12" strokeWidth={2} />
        <path d="M44,4 l6,-3" stroke="#5b450c" strokeWidth={4} strokeLinecap="round" />
      </g>,
    );
  if (l.item === 'star')
    out.push(
      <path
        key="star"
        d={`M${a.side * 0.72},${a.top + 2} q3,14 16,17 q-13,3 -16,17 q-3,-14 -16,-17 q13,-3 16,-17z`}
        fill="#ffe27a"
        stroke="#fff6c4"
        strokeWidth={2}
        className="animate-[twinkle_2.4s_ease-in-out_infinite]"
      />,
    );
  if (l.hat === 'bucket')
    out.push(
      <g key="hat" transform={`translate(0,${a.top + 6})`}>
        <ellipse cx={0} cy={6} rx={78} ry={16} fill="#f2c230" stroke="#9c7a12" strokeWidth={2.5} />
        <path d="M-50,6 Q-48,-46 0,-48 Q48,-46 50,6Z" fill="#f2c230" stroke="#9c7a12" strokeWidth={2.5} />
        <path d="M-30,-20 q10,-10 20,0 q-10,8 -20,0z" fill="#4caf6a" />
        <path d="M8,-34 q12,-6 18,6 q-12,6 -18,-6z" fill="#e2463e" />
        <path d="M18,-8 q10,-8 18,2 q-10,8 -18,-2z" fill="#3c8ee0" />
        <path d="M-44,0 q14,-8 22,2 q-12,6 -22,-2z" fill="#e2463e" />
        <path d="M-8,-4 q8,-10 16,0 q-8,6 -16,0z" fill="#9b59d0" />
      </g>,
    );
  if (l.hat === 'crown')
    out.push(
      <g key="hat" transform={`translate(0,${a.top + 4})`}>
        <path d="M-34,6 L-38,-30 L-18,-12 L0,-40 L18,-12 L38,-30 L34,6Z" fill="#e3b744" stroke="#9c7a12" strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={0} cy={-8} r={7} fill="#d6559b" stroke="#fff" strokeWidth={1.5} />
        <circle cx={-38} cy={-31} r={4} fill="#fff7d6" />
        <circle cx={0} cy={-41} r={4} fill="#fff7d6" />
        <circle cx={38} cy={-31} r={4} fill="#fff7d6" />
      </g>,
    );
  const arm = (side: -1 | 1, node: ReactNode, rot = 0) => (
    <g key={`arm${side}`} transform={`translate(${side * a.side * 0.96},${a.belly - 14}) rotate(${side * rot})`}>
      {node}
    </g>
  );
  const nub = (fill: string) => <ellipse cx={0} cy={0} rx={16} ry={20} fill={fill} stroke={shade(l.color, -0.2)} strokeWidth={2} />;
  if (l.hands === 'peace')
    for (const s of [-1, 1] as const)
      out.push(
        arm(
          s,
          <g>
            {nub(l.color)}
            <path d={`M${s * 2},-14 l${s * -6},-24 M${s * 8},-12 l${s * 4},-24`} stroke={l.color} strokeWidth={9} strokeLinecap="round" />
            <path d={`M${s * 2},-14 l${s * -6},-24 M${s * 8},-12 l${s * 4},-24`} stroke={shade(l.color, -0.2)} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.6} />
          </g>,
          -20,
        ),
      );
  if (l.hands === 'robot')
    for (const s of [-1, 1] as const)
      out.push(
        arm(
          s,
          <g>
            <rect x={-17} y={-24} width={34} height={48} rx={12} fill="#3c4148" stroke="#20242a" strokeWidth={2.5} />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={-12} y={-18 + i * 14} width={24} height={6} rx={3} fill="#4ff3ff" filter="url(#puni-glow)" />
            ))}
            <circle cx={0} cy={24} r={9} fill="#d7a93a" stroke="#8a6519" strokeWidth={2} />
          </g>,
          10,
        ),
      );
  if (l.hands === 'fan') {
    out.push(arm(1, nub(l.color), 0));
    out.push(
      arm(
        -1,
        <g>
          <path d="M0,0 L-46,-30 A55,55 0 0 1 10,-54Z" fill="#7a2448" stroke="#d8a944" strokeWidth={2.5} />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M0,0 L${-46 + i * 13},${-30 - i * 6}`} stroke="#d8a944" strokeWidth={1.5} />
          ))}
          {nub(l.color)}
        </g>,
        0,
      ),
    );
  }
  if (l.hands === 'spray') {
    out.push(arm(-1, <g>{nub(l.color)}</g>, 30));
    out.push(
      arm(
        1,
        <g>
          <rect x={-2} y={-46} width={22} height={44} rx={5} fill="#9aa5b1" stroke="#525a63" strokeWidth={2} />
          <rect x={-2} y={-34} width={22} height={14} fill="#4fc3f7" />
          <rect x={4} y={-54} width={10} height={9} rx={2} fill="#525a63" />
          {nub(l.color)}
        </g>,
        0,
      ),
    );
  }
  return <>{out}</>;
}
