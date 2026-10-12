/**
 * The picture sampler (client request 2026-10-12): one-shot effects on the VJ screen, fired from the
 * pad on the mixer's left (the right one is the sound sampler). Drawn over the mix for a moment and
 * gone. Kept gentle for children: nothing flashes more than ~2 times a second.
 */
export type VisualId = 'flash' | 'glitch' | 'invert' | 'mirror' | 'stars' | 'rainbow';

export const VISUALS: { id: VisualId; name: string; icon: string }[] = [
  { id: 'flash', name: 'FLASH', icon: '⚪' },
  { id: 'glitch', name: 'GLITCH', icon: '📺' },
  { id: 'invert', name: 'INVERT', icon: '🌗' },
  { id: 'mirror', name: 'MIRROR', icon: '🔮' },
  { id: 'stars', name: 'STARS', icon: '✨' },
  { id: 'rainbow', name: 'RAINBOW', icon: '🌈' },
];

/** how long each lasts, seconds */
const LENGTH: Record<VisualId, number> = { flash: 0.45, glitch: 0.9, invert: 0.7, mirror: 1.6, stars: 1.4, rainbow: 1.6 };

/** The effects playing now (each tap adds one; they layer). */
export class VisualSampler {
  private live: { id: VisualId; at: number; seed: number }[] = [];

  fire(id: VisualId) {
    this.live.push({ id, at: performance.now(), seed: Math.random() * 1000 });
  }

  /** Draw whatever is playing over the finished frame on `g` (size S×S). */
  draw(g: CanvasRenderingContext2D, S: number) {
    const now = performance.now();
    this.live = this.live.filter((v) => (now - v.at) / 1000 < LENGTH[v.id]);
    for (const v of this.live) {
      const t = (now - v.at) / 1000;
      const k = t / LENGTH[v.id]; // 0 → 1
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      DRAW[v.id](g, S, k, t, v.seed);
      g.restore();
    }
  }
}

const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const DRAW: Record<VisualId, (g: CanvasRenderingContext2D, S: number, k: number, t: number, seed: number) => void> = {
  // a white flash fading out
  flash(g, S, k) {
    g.globalAlpha = (1 - k) ** 2;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, S, S);
  },
  // slices of the picture pushed sideways, with colour fringes; new slices a few times a second
  glitch(g, S, k, t, seed) {
    const step = Math.floor(t * 12);
    const copy = g.canvas;
    for (let n = 0; n < 7; n++) {
      const r = rand(seed + step * 31 + n);
      const y = rand(seed + step * 17 + n * 7) * S;
      const h = S * (0.03 + r * 0.1);
      const dx = (rand(seed + step + n * 3) - 0.5) * S * 0.25 * (1 - k);
      g.drawImage(copy, 0, y, S, h, dx, y, S, h);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 * (1 - k);
      g.fillStyle = n % 2 ? '#ff2a6d' : '#05d9e8';
      g.fillRect(dx * 1.4, y, S, h * 0.3);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
  },
  // the picture turned negative, fading back
  invert(g, S, k) {
    g.globalCompositeOperation = 'difference';
    g.globalAlpha = k < 0.6 ? 1 : (1 - k) / 0.4;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, S, S);
  },
  // the left half mirrored onto the right, then the top onto the bottom (a kaleidoscope)
  mirror(g, S, k) {
    const copy = document.createElement('canvas');
    copy.width = copy.height = S;
    copy.getContext('2d')!.drawImage(g.canvas, 0, 0);
    const a = k < 0.85 ? 1 : (1 - k) / 0.15;
    g.globalAlpha = a;
    g.save();
    g.translate(S, 0);
    g.scale(-1, 1);
    g.drawImage(copy, 0, 0, S / 2, S, 0, 0, S / 2, S);
    g.restore();
    copy.getContext('2d')!.drawImage(g.canvas, 0, 0);
    g.save();
    g.translate(0, S);
    g.scale(1, -1);
    g.drawImage(copy, 0, 0, S, S / 2, 0, 0, S, S / 2);
    g.restore();
  },
  // a burst of stars flying out from the middle
  stars(g, S, k, _t, seed) {
    g.globalCompositeOperation = 'lighter';
    for (let n = 0; n < 36; n++) {
      const a = rand(seed + n) * Math.PI * 2;
      const speed = 0.3 + rand(seed + n * 5) * 0.7;
      const d = (S / 2) * k * speed * 1.3;
      const x = S / 2 + Math.cos(a) * d;
      const y = S / 2 + Math.sin(a) * d;
      const r = (S / 60) * (1.5 - k) * (0.6 + rand(seed + n * 9));
      g.globalAlpha = 1 - k;
      g.fillStyle = ['#fff7a8', '#ffffff', '#ffd1f0', '#a8f0ff'][n % 4];
      g.beginPath();
      for (let p = 0; p < 10; p++) {
        const rr = p % 2 ? r * 0.45 : r;
        const pa = (p / 10) * Math.PI * 2 + k * 3;
        g.lineTo(x + Math.cos(pa) * rr, y + Math.sin(pa) * rr);
      }
      g.fill();
    }
  },
  // a turning rainbow washed over the picture
  rainbow(g, S, k) {
    const grad = g.createConicGradient(k * Math.PI * 4, S / 2, S / 2);
    ['#ff004c', '#ff9a00', '#ffe600', '#2bff88', '#00c8ff', '#7a3cff', '#ff004c'].forEach((c, i, all) => grad.addColorStop(i / (all.length - 1), c));
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = Math.sin(k * Math.PI) * 0.85;
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  },
};
