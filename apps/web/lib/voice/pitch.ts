/**
 * Pitch without changing the speed, in the browser — the same idea as the server's toMp3()
 * (apps/api/src/voice/voice.service.ts: asetrate + aresample + atempo): first stretch the voice to r× its length
 * keeping the pitch (WSOLA), then play it r× faster (playbackRate = r), which brings it back to its length and raises
 * the pitch by r. r = 2^(key / 12).
 */
export function semitoneRatio(key: number) {
  return Math.pow(2, key / 12);
}

/** WSOLA time stretch: out ≈ input.length × factor, same pitch. Mono. */
export function wsolaStretch(input: Float32Array, factor: number, sampleRate: number): Float32Array<ArrayBuffer> {
  if (Math.abs(factor - 1) < 1e-4) return new Float32Array(input);
  const N = sampleRate >= 44100 ? 2048 : 1024; // ~45 ms window
  const Hs = N / 2; // synthesis hop
  const Ha = Hs / factor; // analysis hop
  const tol = N / 4; // how far a frame may shift to line up with the last one
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const outLen = Math.ceil(input.length * factor) + N;
  const out = new Float32Array(outLen);
  const norm = new Float32Array(outLen);
  let prevStart = 0;
  for (let k = 0; ; k++) {
    const outPos = k * Hs;
    const nominal = Math.round(k * Ha);
    if (nominal + N + tol >= input.length || outPos + N >= outLen) break;
    let best = nominal;
    if (k > 0) {
      // the natural continuation of the previous frame, Hs samples further on
      const target = prevStart + Hs;
      let bestScore = -Infinity;
      const from = Math.max(0, nominal - tol);
      const to = Math.min(input.length - N, nominal + tol);
      for (let s = from; s <= to; s += 2) {
        let score = 0;
        for (let i = 0; i < N; i += 4) score += input[s + i] * input[target + i];
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
    }
    for (let i = 0; i < N; i++) {
      out[outPos + i] += input[best + i] * win[i];
      norm[outPos + i] += win[i];
    }
    prevStart = best;
  }
  const len = Math.min(outLen, Math.ceil(input.length * factor));
  const res = new Float32Array(len);
  for (let i = 0; i < len; i++) res[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return res;
}

/** A recording shifted by `key` semitones, ready to play at `rate` (the buffer is r× long; rate r restores it). */
export function pitchBuffer(ctx: BaseAudioContext, src: AudioBuffer, key: number): { buffer: AudioBuffer; rate: number } {
  const r = semitoneRatio(key);
  const mono = new Float32Array(src.length);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const d = src.getChannelData(c);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / src.numberOfChannels;
  }
  const stretched = wsolaStretch(mono, r, src.sampleRate);
  const buffer = ctx.createBuffer(1, stretched.length, src.sampleRate);
  buffer.copyToChannel(stretched, 0);
  return { buffer, rate: r };
}
