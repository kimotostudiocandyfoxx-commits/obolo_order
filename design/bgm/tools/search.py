"""Loop search on rhythm (spectral-flux onset envelope, 8 s leading into each point) and timbre (band energies, 3 s).
Usage: search.py track emax ewin minlen"""
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from env import load
import numpy as np

SR = 48000
f, emax, ewin, minlen = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
m = load(f).mean(1)
hop, nfft = 240, 1024
n = (len(m) - nfft) // hop
fr = np.lib.stride_tricks.sliding_window_view(m, nfft)[::hop][:n] * np.hanning(nfft)
X = np.abs(np.fft.rfft(fr, axis=1))
Sl = np.log1p(100 * X)
on = np.concatenate([[0], np.maximum(0, np.diff(Sl, axis=0)).sum(1)])
on = on - np.convolve(on, np.ones(40) / 40, 'same')
# band energies for timbre, per 5 ms frame, 24 bands
edges = np.unique(np.geomspace(1, nfft // 2, 30).astype(int))
B = np.log(np.add.reduceat(X ** 2, edges, axis=1) + 1e-9)
B -= B.mean(0)
W = 8 * 200
Wt = 3 * 200
cum = np.concatenate([[0], np.cumsum(on ** 2)])
res = []
for E in np.arange(emax - ewin, emax, 0.01):
    kE = int(E * 200)
    a = on[kE - W:kE]
    a = (a - a.mean())
    na = np.linalg.norm(a)
    # correlation of a with every window ending at k
    full = np.correlate(on, a, 'valid')  # full[j] = sum on[j:j+W]*a
    ends = np.arange(W, len(on) + 1)
    norms = np.sqrt(cum[ends] - cum[ends - W])
    c = full / (norms * na + 1e-9)
    kS = ends
    ok = (kS >= int(3.2 * 200)) & (kS <= kE - int(minlen * 200))
    if not ok.any():
        continue
    cc = np.where(ok, c, -2)
    for j in np.argsort(-cc)[:3]:
        res.append((cc[j], E, kS[j] / 200))
res.sort(reverse=True)
seen = []
out = []
for c, E, S in res:
    if any(abs(E - e) < 1 and abs(S - s) < 1 for _, e, s in seen):
        continue
    kE, kS = int(E * 200), int(S * 200)
    ta, tb = B[kE - Wt:kE].ravel(), B[kS - Wt:kS].ravel()
    tim = float(ta @ tb / (np.linalg.norm(ta) * np.linalg.norm(tb)))
    seen.append((c, E, S))
    out.append((c + 0.6 * tim, c, tim, S, E))  # {c:.3f} timbre {tim:.3f}  S={S:.3f} E={E:.3f} len={E - S:.2f}')
    if len(seen) >= 80:
        break
out.sort(reverse=True)
for sc, c, tim, S, E in out[:8]:
    print(f'score {sc:.3f} rhythm {c:.3f} timbre {tim:.3f}  S={S:.3f} E={E:.3f} len={E - S:.2f}')
