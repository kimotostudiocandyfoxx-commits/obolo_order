"""Write a loop version of a track: audio[0:E], its last XF seconds crossfaded (raised cosine) into the XF seconds before
S, so a jump E -> S continues the music. S is refined to the sample (±4 ms) by waveform cross-correlation.
Usage: build.py in out.wav S E

The day-2 tracks (2026-11-28; S/E from search.py, then enc.sh to -16 LUFS AAC 128k; the loop points the app uses are
lib/onboarding/media.ts BGM_LOOPS, the refined S printed here):
  build.py day2-kimorin-theme-source.mp3 k.wav 50.16 101.07    && enc.sh k.wav bgm-d2-kimorin.m4a
  build.py day2-earth-temple-source.mp3 t.wav 66.105 154.78    && enc.sh t.wav bgm-d2-temple.m4a
  build.py day2-crimson-pulse-source.mp3 c.wav 82.905 168.44   && enc.sh c.wav bgm-d2-crimson.m4a"""
import sys, wave
sys.path.insert(0, __import__('os').path.dirname(__file__))
from env import load
import numpy as np

SR = 48000
src, out, S, E = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
a = load(src).astype(np.float64)
m = a.mean(1)
eS = int(round(E * SR))
w = int(0.05 * SR)
seg = m[eS - w:eS]
best, bk = -1e18, 0
for d in range(-192, 193):
    s0 = int(round(S * SR)) + d
    v = float(np.dot(seg, m[s0 - w:s0]))
    if v > best:
        best, bk = v, d
sS = int(round(S * SR)) + bk
XF = int(0.6 * SR)
y = a[:eS].copy()
t = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, XF))[:, None]
y[eS - XF:eS] = a[eS - XF:eS] * (1 - t) + a[sS - XF:sS] * t
# 0.5 s of what follows S after E: the jump is then inside the file, away from the codec's end of stream
y = np.concatenate([y, a[sS:sS + SR // 2]])
pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
wv = wave.open(out, 'wb')
wv.setnchannels(2)
wv.setsampwidth(2)
wv.setframerate(SR)
wv.writeframes(pcm.tobytes())
wv.close()
print(f'LOOP start={sS / SR:.4f} end={eS / SR:.4f} (S moved {bk / SR * 1000:.1f} ms)')
