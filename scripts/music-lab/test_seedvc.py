#!/usr/bin/env python3
"""Music lab (2026-10-09): gpu/music/svc_worker.py's Seed-VC conversion on CPU — a sung vocal from
Seed-VC's own examples turned into a reference speaker's voice. Run from /tmp/seedvc (Seed-VC
checkout) by .github/workflows/music-lab.yml; writes the result to $OUT."""
import os
import sys
import time

sys.path.insert(0, os.environ["APP_DIR"])
sys.path.insert(0, os.getcwd())
import svc_worker  # noqa: E402

t = time.time()
svc_worker.load()
print(f"loaded in {time.time() - t:.0f}s")
out = os.environ["OUT"]
res = svc_worker.convert("examples/source/TECHNOPOLIS - 2085 [vocals]_[cut_14sec].wav", "examples/reference/s1p1.wav", out, steps=int(os.environ.get("STEPS", "10")), cfg=0.7)
print(res)
assert res["ok"] and os.path.getsize(out) > 100_000
print("ok")
