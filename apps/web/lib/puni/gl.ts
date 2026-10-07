/**
 * Painted ぷにぷに: a round picture warped onto a soft body with WebGL (no seams).
 * Shared by the Saturn world and the /preview/puni-image prototype.
 */
import { localPoints, N, stretchMatrix, type Blob } from './physics';

/**
 * The warped outline of a blob in screen px, as a triangle fan: centre, then a smooth ring
 * (3 points per edge segment along a Catmull-Rom curve), with each point's texture position
 * on the round picture (rest = a circle). Drawn with WebGL so there are no seams.
 */
export function fanVertices(b: Blob, out: Float32Array): number {
  const pts = localPoints(b);
  const [ma, mb, mc, md] = stretchMatrix(b);
  const ca = Math.cos(b.angle);
  const sa = Math.sin(b.angle);
  const toScreen = (lx: number, ly: number): [number, number] => {
    const rx = lx * ca - ly * sa;
    const ry = lx * sa + ly * ca;
    return [b.x + ma * rx + mc * ry, b.y + mb * rx + md * ry];
  };
  const UVR = 0.49; // the picture's own radius in texture units
  let k = 0;
  const push = (x: number, y: number, u: number, v: number) => {
    out[k++] = x;
    out[k++] = y;
    out[k++] = u;
    out[k++] = v;
  };
  const c = toScreen(0, b.cy * 0.3);
  push(c[0], c[1], 0.5, 0.5);
  const SUB = 3;
  for (let i = 0; i <= N; i++) {
    const ii = i % N;
    const p0 = pts[(ii + N - 1) % N];
    const p1 = pts[ii];
    const p2 = pts[(ii + 1) % N];
    const p3 = pts[(ii + 2) % N];
    for (let s = 0; s < (i === N ? 1 : SUB); s++) {
      const t = s / SUB;
      const t2 = t * t;
      const t3 = t2 * t;
      const q = (a0: number, a1: number, a2: number, a3: number) => 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
      const [x, y] = toScreen(q(p0[0], p1[0], p2[0], p3[0]), q(p0[1], p1[1], p2[1], p3[1]));
      const ang = ((ii + t) / N) * Math.PI * 2;
      push(x, y, 0.5 + Math.cos(ang) * UVR, 0.5 + Math.sin(ang) * UVR);
    }
  }
  return k / 4;
}

const VS = `attribute vec2 p; attribute vec2 uv; uniform vec2 size; varying vec2 vuv;
void main() { vuv = uv; gl_Position = vec4(p.x / size.x * 2.0 - 1.0, 1.0 - p.y / size.y * 2.0, 0.0, 1.0); }`;
const FS = `precision mediump float; varying vec2 vuv; uniform sampler2D tex;
void main() { gl_FragColor = texture2D(tex, vuv); }`;

/** A tiny WebGL renderer: one textured triangle fan per character. */
export function makeRenderer(cv: HTMLCanvasElement) {
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: true, alpha: true });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const x = gl.createShader(type)!;
    gl.shaderSource(x, src);
    gl.compileShader(x);
    return x;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const lp = gl.getAttribLocation(prog, 'p');
  const luv = gl.getAttribLocation(prog, 'uv');
  gl.enableVertexAttribArray(lp);
  gl.enableVertexAttribArray(luv);
  gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(luv, 2, gl.FLOAT, false, 16, 8);
  const uSize = gl.getUniformLocation(prog, 'size');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const textures = new Map<string, WebGLTexture>();
  const failed = new Set<string>();
  const verts = new Float32Array(4 * (N * 3 + 4));
  return {
    texture(id: string, img: HTMLImageElement) {
      if (textures.has(id) || !img.complete || !img.naturalWidth) return textures.get(id);
      if (failed.has(id)) return undefined;
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch {
        // a picture from another site without CORS headers cannot be used by WebGL
        failed.add(id);
        return undefined;
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textures.set(id, t);
      return t;
    },
    frame(W: number, H: number) {
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uSize, W, H);
    },
    draw(b: Blob, t: WebGLTexture) {
      const n = fanVertices(b, verts);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, n * 4), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, n);
    },
  };
}

