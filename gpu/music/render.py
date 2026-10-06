"""
Guide audio for the melody-conditioned generator: the song design's chord loop (pads + bass) and
its melody rendered as plain synth tones. MusicGen-Melody follows the chroma of this guide, so the
instrumental keeps the design's tempo, key and chords — and the DiffSinger vocal will fit on top.
"""
import numpy as np

SCALES = {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10]}


def midi_hz(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def chord(root: int, scale: str, degree: int) -> list[int]:
    s = SCALES.get(scale, SCALES["major"])
    out = []
    for k in (0, 2, 4):
        i = degree + k
        out.append(48 + root + s[i % 7] + 12 * (i // 7))
    return out


def tone(freq: float, n: int, sr: int, harmonics=(1.0, 0.5, 0.25)) -> np.ndarray:
    t = np.arange(n) / sr
    w = sum(a * np.sin(2 * np.pi * freq * (h + 1) * t) for h, a in enumerate(harmonics))
    env = np.minimum(1.0, np.arange(n) / (0.01 * sr)) * np.minimum(1.0, (n - np.arange(n)) / (0.05 * sr))
    return (w * env).astype(np.float32)


def render_guide(seconds: float, bpm: int, key_root: int, scale: str, progression: list[int], melody: list[dict], sr: int = 32000) -> np.ndarray:
    total = int(seconds * sr)
    out = np.zeros(total, dtype=np.float32)
    beat = 60.0 / max(40, min(220, bpm))
    bar = int(4 * beat * sr)
    prog = progression or [0, 4, 5, 3]
    pos, b = 0, 0
    while pos < total:
        n = min(bar, total - pos)
        for m in chord(key_root % 12, scale, prog[b % len(prog)]):
            out[pos : pos + n] += 0.12 * tone(midi_hz(m), n, sr)
        out[pos : pos + n] += 0.18 * tone(midi_hz(chord(key_root % 12, scale, prog[b % len(prog)])[0] - 12), n, sr, (1.0, 0.3))
        pos += bar
        b += 1
    if melody:
        pos, i = 0, 0
        while pos < total and i < 10000:
            note = melody[i % len(melody)]
            n = int(max(0.05, float(note.get("beats", 0.5))) * beat * sr)
            m = note.get("midi")
            if m is not None:
                k = min(n, total - pos)
                out[pos : pos + k] += 0.22 * tone(midi_hz(float(m)), k, sr, (1.0, 0.2))
            pos += n
            i += 1
    peak = float(np.max(np.abs(out))) or 1.0
    return (out / peak * 0.8).astype(np.float32)
