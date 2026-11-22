import { TALK_FACES, type PartBox, type TalkExpression, type TalkFace, type TalkLook, type TalkPose } from '@obolo/shared';

/**
 * Stand-in looks for the side-by-side talk (M-R232〜M-R235) in the demo, the tests and the review pages — nothing is
 * generated: little drawn characters with their six expressions and real swap parts (an eyes-closed patch and an
 * open-mouth patch at their boxes, like the ones the image job cuts out on the server), so the motion can be judged.
 */
const W = 300;
const H = 460;
const svg = (body: string, vb = `0 0 ${W} ${H}`) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`)}`;
const box = (x: number, y: number, w: number, h: number): PartBox => ({ x: x / W, y: y / H, w: w / W, h: h / H });

type Geo = { ex: [number, number]; ey: number; mx: number; my: number; skin: string; ink: string; eyeR: number };

function eyes(g: Geo, f: TalkFace): string {
  const [l, r] = g.ex;
  const { ey, ink, eyeR: e } = g;
  const arc = (x: number) => `<path d="M${x - e} ${ey + 2} Q${x} ${ey - e} ${x + e} ${ey + 2}" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  const dot = (x: number, s = 1, dx = 0, dy = 0) =>
    `<ellipse cx="${x}" cy="${ey}" rx="${e * 0.72 * s}" ry="${e * s}" fill="${ink}"/><circle cx="${x + dx - e * 0.25}" cy="${ey + dy - e * 0.35}" r="${e * 0.32 * s}" fill="#fff"/>`;
  if (f === 'smile' || f === 'shy') return arc(l) + arc(r);
  if (f === 'surprised') return dot(l, 1.25) + dot(r, 1.25) + `<path d="M${l - 12} ${ey - 22} q12 -8 24 0 M${r - 12} ${ey - 22} q12 -8 24 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if (f === 'thinking') return dot(l, 1, 4, -3) + dot(r, 1, 4, -3) + `<path d="M${l - 11} ${ey - 18} l22 -4 M${r - 11} ${ey - 20} l22 2" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  if (f === 'sad') return dot(l, 0.9) + dot(r, 0.9) + `<path d="M${l - 12} ${ey - 15} l22 -7 M${r + 12} ${ey - 15} l-22 -7" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  return dot(l) + dot(r);
}

function mouth(g: Geo, f: TalkFace): string {
  const { mx: x, my: y, ink } = g;
  if (f === 'smile') return `<path d="M${x - 15} ${y - 3} Q${x} ${y + 16} ${x + 15} ${y - 3} Z" fill="#8a2a38"/><path d="M${x - 8} ${y + 5} Q${x} ${y + 10} ${x + 8} ${y + 5}" fill="#e98a8a"/>`;
  if (f === 'surprised') return `<ellipse cx="${x}" cy="${y + 3}" rx="6" ry="8" fill="#8a2a38"/>`;
  if (f === 'thinking') return `<path d="M${x - 8} ${y + 2} l14 -2" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`;
  if (f === 'sad') return `<path d="M${x - 10} ${y + 6} Q${x} ${y - 3} ${x + 10} ${y + 6}" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  if (f === 'shy') return `<path d="M${x - 9} ${y + 1} q4.5 4 9 0 q4.5 4 9 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `<path d="M${x - 10} ${y} Q${x} ${y + 9} ${x + 10} ${y}" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
}

const cheeks = (g: Geo, f: TalkFace) =>
  `<ellipse cx="${g.ex[0] - 10}" cy="${g.ey + 22}" rx="${f === 'shy' ? 16 : 11}" ry="${f === 'shy' ? 9 : 6}" fill="#ff8fa8" opacity="${f === 'shy' ? 0.85 : 0.45}"/><ellipse cx="${g.ex[1] + 10}" cy="${g.ey + 22}" rx="${f === 'shy' ? 16 : 11}" ry="${f === 'shy' ? 9 : 6}" fill="#ff8fa8" opacity="${f === 'shy' ? 0.85 : 0.45}"/>`;

/** the eyes-closed patch: the skin over the eyes, then closed lids (cut to the eyes' box) */
function blinkPatch(g: Geo, b: PartBox): string {
  const [l, r] = g.ex;
  const e = g.eyeR;
  const lid = (x: number) => `<ellipse cx="${x}" cy="${g.ey}" rx="${e * 1.5}" ry="${e * 1.55}" fill="${g.skin}"/><path d="M${x - e} ${g.ey + 1} Q${x} ${g.ey + e * 0.9} ${x + e} ${g.ey + 1}" stroke="${g.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  return svg(lid(l) + lid(r), `${b.x * W} ${b.y * H} ${b.w * W} ${b.h * H}`);
}

/** the open-mouth patch (cut to the mouth's box) */
function mouthPatch(g: Geo, b: PartBox): string {
  const { mx: x, my: y } = g;
  return svg(
    `<ellipse cx="${x}" cy="${y + 3}" rx="19" ry="13" fill="${g.skin}"/><path d="M${x - 12} ${y - 2} Q${x} ${y - 5} ${x + 12} ${y - 2} Q${x + 11} ${y + 15} ${x} ${y + 15} Q${x - 11} ${y + 15} ${x - 12} ${y - 2} Z" fill="#7a2232"/><ellipse cx="${x}" cy="${y + 10}" rx="7" ry="4" fill="#e98a8a"/>`,
    `${b.x * W} ${b.y * H} ${b.w * W} ${b.h * H}`,
  );
}

function hue(seed: string) {
  return [...seed].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
}

/** a hooded NEO (fox ears, a tail, a cloak) — the member's own look in the demo */
export function demoNeoTalkLook(seed = 'neo', of?: string): TalkLook {
  const h = hue(seed);
  const robe = `hsl(${h},55%,46%)`;
  const trim = `hsl(${(h + 40) % 360},80%,72%)`;
  const g: Geo = { ex: [126, 174], ey: 156, mx: 150, my: 190, skin: '#f7d6c2', ink: '#2a1a24', eyeR: 9 };
  const body =
    // the tail and the cloak
    `<path d="M200 360 C 268 350 290 290 262 250 C 252 300 232 320 196 330 Z" fill="${trim}" stroke="${robe}" stroke-width="5"/>` +
    `<path d="M150 214 C 104 214 86 250 80 300 L 66 398 L 234 398 L 220 300 C 214 250 196 214 150 214 Z" fill="${robe}" stroke="${trim}" stroke-width="5"/>` +
    `<path d="M150 214 L 150 398" stroke="${trim}" stroke-width="3" opacity=".6"/><circle cx="150" cy="250" r="9" fill="${trim}"/>` +
    // legs, boots
    `<rect x="112" y="396" width="26" height="44" rx="8" fill="#3a2a40"/><rect x="162" y="396" width="26" height="44" rx="8" fill="#3a2a40"/>` +
    `<ellipse cx="122" cy="444" rx="20" ry="10" fill="#22172a"/><ellipse cx="178" cy="444" rx="20" ry="10" fill="#22172a"/>` +
    // the hood with its ears, the face
    `<path d="M78 70 L 104 12 L 122 74 Z" fill="${robe}" stroke="${trim}" stroke-width="5" stroke-linejoin="round"/><path d="M222 70 L 196 12 L 178 74 Z" fill="${robe}" stroke="${trim}" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="M96 32 L 106 60 L 114 62 Z M204 32 L 194 60 L 186 62 Z" fill="#ffd2dc"/>` +
    `<path d="M150 60 C 84 60 62 120 70 180 C 76 222 108 236 150 236 C 192 236 224 222 230 180 C 238 120 216 60 150 60 Z" fill="${robe}" stroke="${trim}" stroke-width="5"/>` +
    `<ellipse cx="150" cy="166" rx="62" ry="58" fill="${g.skin}"/>` +
    `<path d="M92 140 C 104 104 128 98 150 112 C 172 98 196 104 208 140 C 196 122 176 118 162 128 C 152 116 140 116 130 128 C 120 118 102 124 92 140 Z" fill="hsl(${(h + 200) % 360},35%,32%)"/>`;
  return demoLook(of ?? `demo-neo-${seed}`, g, body, (f) => cheeks(g, f), box(100, 132, 100, 48), box(126, 172, 48, 36), true);
}

/** a round {bati} (the seed's mark on its head) — {bati} in the demo */
export function demoBatiTalkLook(seed = 'たこ焼き', of?: string, mark = '🐙'): TalkLook {
  const h = hue(seed);
  const g: Geo = { ex: [116, 184], ey: 292, mx: 150, my: 334, skin: `hsl(${h},85%,80%)`, ink: '#24172e', eyeR: 12 };
  const body =
    `<path d="M108 200 C 96 160 106 128 122 120 C 128 150 134 170 140 196 Z M192 200 C 204 160 194 128 178 120 C 172 150 166 170 160 196 Z" fill="hsl(${h},70%,66%)"/>` +
    `<ellipse cx="112" cy="438" rx="28" ry="14" fill="hsl(${h},55%,52%)"/><ellipse cx="188" cy="438" rx="28" ry="14" fill="hsl(${h},55%,52%)"/>` +
    `<ellipse cx="150" cy="318" rx="128" ry="124" fill="hsl(${h},70%,68%)"/><ellipse cx="150" cy="310" rx="104" ry="96" fill="${g.skin}"/>` +
    `<ellipse cx="44" cy="330" rx="20" ry="30" fill="hsl(${h},70%,64%)" transform="rotate(-20 44 330)"/><ellipse cx="256" cy="330" rx="20" ry="30" fill="hsl(${h},70%,64%)" transform="rotate(20 256 330)"/>` +
    `<text x="150" y="226" font-size="52" text-anchor="middle" dominant-baseline="middle">${mark}</text>`;
  return demoLook(of ?? `demo-bati-${seed}`, g, body, (f) => cheeks(g, f), box(92, 268, 116, 50), box(124, 318, 52, 38), false);
}

function demoLook(of: string, g: Geo, body: string, extra: (f: TalkFace) => string, eyesBox: PartBox, mouthBox: PartBox, self: boolean): TalkLook {
  const faces: Partial<Record<TalkFace, TalkExpression>> = {};
  const want = self ? (['normal', 'smile', 'surprised', 'shy'] as TalkFace[]) : [...TALK_FACES];
  for (const f of want) {
    const url = svg(body + extra(f) + eyes(g, f) + mouth(g, f));
    // the parts are cut for the faces that talk most (P-TALK-2: normal, smile), as on the server
    faces[f] = f === 'normal' || f === 'smile' ? { kind: 'image', url, blink: blinkPatch(g, eyesBox), eyesBox, mouth: mouthPatch(g, mouthBox), mouthBox } : { kind: 'image', url };
  }
  const stand = (faces.normal as { url: string }).url;
  return { of, stand, faces };
}

/** the review page's group: a few demo looks in different colours */
export const DEMO_GROUP_SEEDS = ['あお', 'みどり', 'もも', 'きいろ', 'むらさき', 'しろ', 'あか'];

/**
 * The client's talk cast (design/talk on the story branch → public/talk): a NEO, a dachi and a {bati}, each with its
 * faces, an eyes-closed and an open-mouth picture (whole pictures, aligned to the same body: the blink and the lip flap
 * swap the whole figure) and its コロリン. The demo, the tests and the review page stand them in for generated looks.
 */
export type CastId = 'user' | 'friend' | 'bati';
const CAST_FACES: Record<CastId, TalkFace[]> = {
  user: ['normal', 'smile', 'surprised', 'shy'],
  friend: [...TALK_FACES],
  bati: [...TALK_FACES],
};
export function castLook(id: CastId, of = `cast-${id}`): TalkLook {
  const u = (f: string) => `/talk/${id}/${f}.webp`;
  // M-R240, one shared canvas (same size, same feet, headroom for raised arms): the plain stand with its blink and open
  // mouth, and a pose for each expression with its open mouth (the smile's pose blinks too)
  const faces: Partial<Record<TalkFace, TalkExpression>> = { normal: { kind: 'image', url: u('stand'), blink: u('stand-blink'), mouth: u('stand-talk') } };
  const poses: Partial<Record<TalkFace, TalkPose>> = {};
  for (const f of CAST_FACES[id]) if (f !== 'normal') poses[f] = { url: u(`${f}-pose`), mouth: u(`${f}-pose-talk`), ...(f === 'smile' ? { blink: u('smile-pose-blink') } : {}) };
  return { of, stand: u('stand'), faces, poses };
}
