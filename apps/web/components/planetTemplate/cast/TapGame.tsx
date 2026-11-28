'use client';

import { useEffect, useRef, useState } from 'react';
import { BOARD, GAME_LABEL, GAME_SFX, newGame, rippleUniform, stepGame, tapGame, WOBBLE_FS, WOBBLE_VS, type GameState } from '@/lib/planetTemplate/castGame';
import { castGamePicture, type CastWorks } from '@/lib/planetTemplate/castWorks';
import { playSfx } from '@/lib/planetTemplate/sfx';
import c from './Cast.module.css';

/** サーぽん's wobble: his picture as a texture, each touch a ripple that rings down (the prototype's shader) */
function wobbleGl(cv: HTMLCanvasElement, im: HTMLImageElement): ((st: GameState) => void) | null {
  const gl = cv.getContext('webgl', { premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, WOBBLE_VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, WOBBLE_FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const bf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const lp = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(lp);
  gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  const tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const hl = gl.getUniformLocation(pr, 'h');
  return (st) => {
    gl.uniform4fv(hl, rippleUniform(st));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

/** the six other toys, drawn as the prototype's kidGame: the blots, the character, the particles */
function draw2d(g: CanvasRenderingContext2D, im: HTMLImageElement, st: GameState, now: number) {
  g.clearRect(0, 0, BOARD, BOARD);
  for (const b of st.blots) {
    g.globalAlpha = Math.max(0, b.a);
    g.fillStyle = '#16121f';
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * Math.PI * 2;
      const rr = b.r * (0.75 + 0.35 * Math.sin(i * 2.7 + b.s));
      g.lineTo(b.x + Math.cos(an) * rr, b.y + Math.sin(an) * rr);
    }
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  if (im.complete && im.naturalWidth) {
    const W = 360 * Math.min(1, im.naturalWidth / im.naturalHeight);
    const H = (W * im.naturalHeight) / im.naturalWidth;
    const s = 1 + Math.sin(now / 220) * 0.015;
    g.save();
    g.translate(st.x, st.y - st.h);
    g.rotate(st.rot + (st.kind === 'jump' ? st.flip * -Math.PI * 2 : 0));
    g.scale(s * (1 + st.sq), s * (1 - st.sq));
    g.drawImage(im, -W / 2, -H / 2, W, H);
    g.restore();
  }
  for (const p of st.parts) {
    g.globalAlpha = Math.max(0, Math.min(1, p.a));
    g.fillStyle = p.c;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.beginPath();
    if (p.shape === 'petal') g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2);
    else if (p.shape === 'grain') g.ellipse(0, 0, p.s * 0.45, p.s, 0, 0, Math.PI * 2);
    else g.arc(0, 0, p.s, 0, Math.PI * 2);
    g.fill();
    if (p.shape === 'grain') {
      g.strokeStyle = 'rgba(0,0,0,.15)';
      g.stroke();
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

/**
 * Neptune: a cast member's tap game (handoff planets-08 §3, the prototype's sapGame / kidGame), played where the work
 * opens. Each tap on the board does the game's one thing with its own sound, and counts. `touch` false (▶): it only
 * shows (the character breathing).
 */
export function TapGame({ cast, touch = true }: { cast: CastWorks; touch?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<GameState>(newGame(cast.gameKind));
  const [count, setCount] = useState(0);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const st = (game.current = newGame(cast.gameKind));
    setCount(0);
    const im = new Image();
    im.src = castGamePicture(cast);
    let raf = 0;
    let last = performance.now();
    let gl: ((s: GameState) => void) | null = null;
    let g2: CanvasRenderingContext2D | null = null;
    let ready = false;
    const start = () => {
      if (ready) return;
      ready = true;
      // サーぽん's ripple needs WebGL; without it (or for the other six) the board is drawn in 2D
      if (st.kind === 'wobble') gl = wobbleGl(cv, im);
      if (!gl) g2 = cv.getContext('2d');
    };
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      stepGame(st, dt);
      if (gl) gl(st);
      else if (g2) draw2d(g2, im, st, now);
      raf = requestAnimationFrame(frame);
    };
    if (im.complete && im.naturalWidth) start();
    else {
      im.onload = start;
      // a picture that cannot be read: the board still plays (particles only)
      im.onerror = () => {
        if (st.kind !== 'wobble') start();
      };
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cast]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    tapGame(game.current, ((e.clientX - r.left) / r.width) * BOARD, ((e.clientY - r.top) / r.height) * BOARD);
    setCount(game.current.count);
    playSfx(GAME_SFX[cast.gameKind]);
  };

  return (
    <div className={c.gscr} data-testid="tap-game" data-kind={cast.gameKind} data-count={count} onClick={touch ? (e) => e.stopPropagation() : undefined}>
      <canvas ref={canvas} width={BOARD} height={BOARD} aria-label={`${cast.name}をタップしてね`} onPointerDown={touch ? tap : undefined} />
      <div className={c.gcnt} data-testid="tap-count">
        {GAME_LABEL[cast.gameKind]} {count}
      </div>
      <div className={`${c.ghint} ${count ? c.off : ''}`}>{cast.name}を タップしてね</div>
    </div>
  );
}
