"""The light pitch correction of a ダチ voice message (client 2026-11-27, sample K; apps/api/src/voice/voice-mix.ts).

    python3 autotune.py <in.wav> <out.wav> <strength 0..1>

praat-parselmouth 0.4.7: Sound -> "To Manipulation" (0.01, 75, 500) -> the pitch tier -> every point f moved toward
the nearest semitone (A = 440 Hz) by `strength` -> "Replace pitch tier" -> "Get resynthesis (overlap-add)".
    st  = 12 * log2(f / 440)
    new = 440 * 2 ** ((st + (round(st) - st) * strength) / 12)
A recording with no pitch points (no voiced sound) is copied as it is. Exit code 0 only when <out.wav> was written.
The caller (Node) gives it a time limit and goes on without the correction when it fails: a message is never lost here.
"""
import math
import shutil
import sys

import parselmouth
from parselmouth.praat import call


def main() -> int:
    src, dst, strength = sys.argv[1], sys.argv[2], max(0.0, min(1.0, float(sys.argv[3])))
    if strength <= 0:
        shutil.copyfile(src, dst)
        return 0
    sound = parselmouth.Sound(src)
    manipulation = call(sound, "To Manipulation", 0.01, 75, 500)
    tier = call(manipulation, "Extract pitch tier")
    count = int(call(tier, "Get number of points"))
    if count == 0:
        shutil.copyfile(src, dst)
        return 0
    tuned = call("Create PitchTier", "tuned", sound.xmin, sound.xmax)
    for i in range(1, count + 1):
        f = call(tier, "Get value at index", i)
        st = 12 * math.log2(f / 440)
        call(tuned, "Add point", call(tier, "Get time from index", i), 440 * 2 ** ((st + (round(st) - st) * strength) / 12))
    call([tuned, manipulation], "Replace pitch tier")
    call(manipulation, "Get resynthesis (overlap-add)").save(dst, "WAV")
    return 0


if __name__ == "__main__":
    sys.exit(main())
