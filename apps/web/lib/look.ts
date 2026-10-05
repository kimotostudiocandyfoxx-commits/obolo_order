/**
 * Demo-mode stand-ins for the generated images (no server, no AI): an SVG portrait built from the
 * answers — the animal as an emoji in a hooded robe of the chosen colour (NEO look), or a round
 * newborn with the favourite food as its body (Bati). PLACEHOLDER (P-AI-3).
 */
const ANIMALS: [RegExp, string][] = [
  [/狐|キツネ|きつね|fox/i, '🦊'],
  [/猫|ネコ|ねこ|cat/i, '🐱'],
  [/犬|イヌ|いぬ|dog/i, '🐶'],
  [/兎|ウサギ|うさぎ|rabbit/i, '🐰'],
  [/狼|オオカミ|おおかみ|wolf/i, '🐺'],
  [/熊|クマ|くま|bear/i, '🐻'],
  [/梟|フクロウ|ふくろう|owl/i, '🦉'],
  [/竜|龍|リュウ|ドラゴン|dragon/i, '🐲'],
  [/鹿|シカ|しか|deer/i, '🦌'],
  [/パンダ|panda/i, '🐼'],
  [/虎|トラ|とら|tiger/i, '🐯'],
  [/ライオン|lion/i, '🦁'],
  [/ペンギン|penguin/i, '🐧'],
  [/ゴリラ|gorilla/i, '🦍'],
  [/カエル|かえる|frog/i, '🐸'],
  [/猿|サル|さる|monkey/i, '🐵'],
];
const COLORS: [RegExp, number][] = [
  [/赤|あか|レッド|red/i, 0],
  [/橙|オレンジ|orange/i, 28],
  [/黄|きいろ|イエロー|yellow|金|ゴールド/i, 48],
  [/緑|みどり|グリーン|green/i, 130],
  [/水色|シアン|cyan/i, 185],
  [/青|あお|ブルー|blue/i, 220],
  [/紫|むらさき|パープル|purple/i, 275],
  [/桃|ピンク|pink/i, 330],
  [/黒|くろ|ブラック|black/i, -1],
  [/白|しろ|ホワイト|white|銀|シルバー/i, -2],
];
const FOODS: [RegExp, string][] = [
  [/ラーメン|らーめん|麺/, '🍜'],
  [/カレー/, '🍛'],
  [/寿司|すし|鮨/, '🍣'],
  [/おにぎり|ご飯|ごはん|米/, '🍙'],
  [/パン/, '🍞'],
  [/ケーキ/, '🍰'],
  [/プリン/, '🍮'],
  [/アイス/, '🍦'],
  [/ピザ/, '🍕'],
  [/ハンバーガー|バーガー/, '🍔'],
  [/たこ焼き|たこやき/, '🐙'],
  [/いちご|苺|イチゴ/, '🍓'],
  [/バナナ/, '🍌'],
  [/りんご|林檎|リンゴ/, '🍎'],
  [/チョコ/, '🍫'],
  [/唐揚げ|からあげ|チキン/, '🍗'],
  [/餃子|ぎょうざ/, '🥟'],
  [/肉|ステーキ|焼肉/, '🥩'],
  [/卵|たまご|オムライス/, '🍳'],
  [/団子|だんご/, '🍡'],
];

const pick = <T,>(list: [RegExp, T][], text: string, fallback: T) => list.find(([re]) => re.test(text))?.[1] ?? fallback;
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function robe(hue: number, v: number) {
  if (hue === -1) return { robe: `hsl(250,10%,${18 + v * 4}%)`, trim: '#d8b45a' };
  if (hue === -2) return { robe: `hsl(220,15%,${86 - v * 4}%)`, trim: '#7aa7d8' };
  const h = (hue + v * 14) % 360;
  return { robe: `hsl(${h},62%,${38 + v * 4}%)`, trim: `hsl(${(h + 40) % 360},80%,70%)` };
}

/** Four OBOLO NEO candidates. */
export function demoNeoLooks(a: { animal: string; color: string; mood: string }, round: number): string[] {
  const emoji = pick(ANIMALS, a.animal, '✨');
  const hue = pick(COLORS, a.color, 260);
  return [0, 1, 2, 3].map((i) => {
    const v = (i + round * 4) % 4;
    const { robe: r, trim } = robe(hue, v);
    const sky = ['#120c2a', '#1a1030', '#0b1430', '#1d0d22'][v];
    const star = Array.from({ length: 18 }, (_, k) => `<circle cx="${(k * 97 + v * 31) % 512}" cy="${(k * 53 + v * 17) % 300}" r="${(k % 3) + 1}" fill="#fff" opacity=".7"/>`).join('');
    return svgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${sky}"/>${star}<circle cx="256" cy="300" r="190" fill="${trim}" opacity=".15"/><path d="M256 120 C 150 120 110 230 120 330 L 90 500 L 422 500 L 392 330 C 402 230 362 120 256 120 Z" fill="${r}" stroke="${trim}" stroke-width="8"/><path d="M256 150 C 190 150 165 215 172 285 C 200 320 312 320 340 285 C 347 215 322 150 256 150 Z" fill="#0d0a16" opacity=".55"/><text x="256" y="${270 + (v % 2) * 6}" font-size="150" text-anchor="middle" dominant-baseline="middle">${emoji}</text><circle cx="256" cy="380" r="14" fill="${trim}"/></svg>`,
    );
  });
}

/** The newborn Bati. */
export function demoBati(food: string): string {
  const emoji = pick(FOODS, food, '🍬');
  const h = [...food].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 3) % 360;
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="b" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="hsl(${h},90%,88%)"/><stop offset="1" stop-color="hsl(${h},70%,62%)"/></radialGradient></defs><rect width="512" height="512" fill="#140f2e"/><path d="M110 430 L150 400 L170 440 L200 405 L215 445" stroke="#f3ead2" stroke-width="10" fill="none"/><path d="M300 445 L320 405 L350 440 L370 400 L410 430" stroke="#f3ead2" stroke-width="10" fill="none"/><ellipse cx="256" cy="290" rx="170" ry="150" fill="url(#b)"/><text x="256" y="200" font-size="110" text-anchor="middle" dominant-baseline="middle">${emoji}</text><circle cx="205" cy="295" r="26" fill="#1b1430"/><circle cx="307" cy="295" r="26" fill="#1b1430"/><circle cx="214" cy="285" r="9" fill="#fff"/><circle cx="316" cy="285" r="9" fill="#fff"/><path d="M226 345 Q256 370 286 345" stroke="#1b1430" stroke-width="9" fill="none" stroke-linecap="round"/><ellipse cx="175" cy="335" rx="20" ry="11" fill="#ff8fb0" opacity=".7"/><ellipse cx="337" cy="335" rx="20" ry="11" fill="#ff8fb0" opacity=".7"/></svg>`,
  );
}

export const foodEmoji = (food: string) => pick(FOODS, food, '🍬');

/** The Bati egg (Day 3): a glowing egg with the favourite food faintly inside. */
export function eggSvg(food: string): string {
  const emoji = pick(FOODS, food, '🍬');
  const h = [...food].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 3) % 360;
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480"><defs><radialGradient id="e" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".7" stop-color="hsl(${h},70%,86%)"/><stop offset="1" stop-color="hsl(${h},55%,62%)"/></radialGradient><radialGradient id="glow"><stop offset="0" stop-color="hsl(${h},90%,80%)" stop-opacity=".7"/><stop offset="1" stop-color="hsl(${h},90%,80%)" stop-opacity="0"/></radialGradient></defs><ellipse cx="200" cy="260" rx="200" ry="220" fill="url(#glow)"/><path d="M200 50 C 300 50 350 200 350 290 C 350 380 285 440 200 440 C 115 440 50 380 50 290 C 50 200 100 50 200 50 Z" fill="url(#e)" stroke="hsl(${h},50%,55%)" stroke-width="5"/><text x="200" y="290" font-size="120" text-anchor="middle" dominant-baseline="middle" opacity=".28">${emoji}</text><path d="M95 250 Q130 230 160 255 T225 255 T300 250" stroke="hsl(${h},60%,60%)" stroke-width="6" fill="none" opacity=".6"/></svg>`,
  );
}

/** Read a picked image, downscale it (≤768 px JPEG) and return it for the look request. */
export async function fileToReference(file: File): Promise<{ mime: 'image/jpeg'; data: string; url: string }> {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const s = Math.min(1, 768 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.8);
    return { mime: 'image/jpeg', data: url.split(',')[1], url };
  } finally {
    URL.revokeObjectURL(src);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

const hueOf = (text: string, fallback: number) => {
  const h = pick(COLORS, text, fallback);
  return h < 0 ? fallback : h;
};

/** Demo stand-in for a look made from a reference: the picture as an emblem on a hooded robe. */
export async function demoFromReference(refUrl: string, a: { liked: string; twist: string }, variant: number): Promise<string> {
  const img = await loadImage(refUrl);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = ['#120c2a', '#1a1030', '#0b1430', '#1d0d22'][variant % 4];
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#fff';
  for (let k = 0; k < 24; k++) g.fillRect((k * 97 + variant * 31) % 512, (k * 53 + variant * 17) % 300, 2, 2);
  const hue = (hueOf(a.twist, 260) + variant * 25) % 360;
  g.fillStyle = `hsl(${hue},60%,40%)`;
  g.strokeStyle = `hsl(${(hue + 40) % 360},80%,70%)`;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(256, 110);
  g.bezierCurveTo(150, 110, 105, 230, 118, 330);
  g.lineTo(88, 512);
  g.lineTo(424, 512);
  g.lineTo(394, 330);
  g.bezierCurveTo(407, 230, 362, 110, 256, 110);
  g.fill();
  g.stroke();
  g.save();
  g.beginPath();
  g.arc(256, 255, 92, 0, Math.PI * 2);
  g.clip();
  g.filter = `hue-rotate(${variant * 35}deg) saturate(1.2)`;
  const s = Math.max(184 / img.width, 184 / img.height);
  g.drawImage(img, 256 - (img.width * s) / 2, 255 - (img.height * s) / 2, img.width * s, img.height * s);
  g.restore();
  g.fillStyle = `hsl(${(hue + 40) % 360},80%,70%)`;
  g.beginPath();
  g.arc(256, 390, 14, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL('image/jpeg', 0.82);
}

/** Demo stand-in for a refinement: recolour toward the colour named in the instruction. */
export async function demoRefine(url: string, instruction: string, n: number): Promise<string> {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const named = pick(COLORS, instruction, 999);
  g.filter = named !== 999 ? `hue-rotate(${(named + 360 - 260) % 360}deg)` : /明る/.test(instruction) ? 'brightness(1.25)' : /暗|クール/.test(instruction) ? 'brightness(0.8) contrast(1.15)' : `hue-rotate(${40 * (n + 1)}deg)`;
  g.drawImage(img, 0, 0, 512, 512);
  g.filter = 'none';
  g.fillStyle = 'rgba(255,240,200,0.9)';
  g.font = '40px serif';
  g.fillText('✦', 430, 70);
  return c.toDataURL('image/jpeg', 0.82);
}
