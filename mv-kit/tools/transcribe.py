#!/usr/bin/env python3
"""Where each sung character falls in time (Japanese): voice-activity segments of work/vocals.wav, each recognised
with sherpa-onnx (zipformer ReazonSpeech), token timestamps made absolute -> work/asr.json + a readable listing.
  python3 mv-kit/tools/transcribe.py <project-dir> [<tools-dir>]"""
import json, os, subprocess, sys, wave
import numpy as np, sherpa_onnx
PRJ = os.path.abspath(sys.argv[1]); T = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/.mvkit')
d = os.path.join(T, 'asr-ja')
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=f'{d}/encoder-epoch-99-avg-1.int8.onnx', decoder=f'{d}/decoder-epoch-99-avg-1.int8.onnx',
    joiner=f'{d}/joiner-epoch-99-avg-1.int8.onnx', tokens=f'{d}/tokens.txt', num_threads=4, decoding_method='greedy_search')
v16 = os.path.join(PRJ, 'work', 'voc16.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(PRJ, 'work', 'vocals.wav'), '-ac', '1', '-ar', '16000', v16], check=True)
w = wave.open(v16); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
# voice activity: 20 ms loudness, threshold at the 35th percentile (>= -42 dB), gaps < .18 s filled, blips < .12 s dropped
hop = int(sr * .02); n = len(x) // hop
db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-7)
on = db > max(np.percentile(db[db > -80], 35), -42)
segs, s0 = [], None
for i, v in enumerate(list(on) + [False]):
    if v and s0 is None: s0 = i
    if not v and s0 is not None: segs.append([s0, i]); s0 = None
merged = []
for a, b in segs:
    if merged and a - merged[-1][1] < 9: merged[-1][1] = b
    else: merged.append([a, b])
merged = [[a * .02, b * .02] for a, b in merged if b - a >= 6]
# recognise each phrase (joined when short) with a little padding
out = []
xn = x / (np.abs(x).max() + 1e-6) * .9
i = 0
while i < len(merged):
    a, b = merged[i]
    while i + 1 < len(merged) and merged[i + 1][1] - a < 9: i += 1; b = merged[i][1]
    a0, b0 = max(0, a - .3), min(len(x) / sr, b + .3)
    st = rec.create_stream(); st.accept_waveform(sr, xn[int(a0 * sr):int(b0 * sr)]); rec.decode_stream(st)
    r = st.result
    toks = [{'t': round(a0 + tt, 2), 'tok': tok} for tok, tt in zip(r.tokens, r.timestamps)]
    out.append({'from': round(a, 2), 'to': round(b, 2), 'text': r.text, 'tokens': toks})
    print(f'[{a:6.2f} - {b:6.2f}] {r.text}')
    i += 1
json.dump({'phrases': [[round(a, 2), round(b, 2)] for a, b in merged], 'segments': out}, open(os.path.join(PRJ, 'work', 'asr.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('->', os.path.join(PRJ, 'work', 'asr.json'))
