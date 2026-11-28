#!/usr/bin/env bash
# Measures story sound effects (length, mean / peak level, noise floor, samples at peak): scripts/rocket/measure-se.sh id …
cd "$(dirname "$0")/../../apps/web/public/onboarding" || exit 1
for i in "$@"; do
  f="se-$i.mp3"
  if [ ! -f "$f" ]; then echo "$i MISSING"; continue; fi
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  st=$(ffmpeg -hide_banner -i "$f" -af astats -f null - 2>&1)
  vd=$(ffmpeg -hide_banner -i "$f" -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | awk '{print $5}' | tr '\n' '/')
  nf=$(echo "$st" | grep "Noise floor dB" | tail -1 | awk '{print $NF}')
  pc=$(echo "$st" | grep "Peak count" | tail -1 | awk '{print $NF}')
  head=$(ffmpeg -hide_banner -t 0.05 -i "$f" -af volumedetect -f null - 2>&1 | grep max_volume | awk '{print $5}')
  tail=$(ffmpeg -hide_banner -sseof -0.1 -i "$f" -af volumedetect -f null - 2>&1 | grep max_volume | awk '{print $5}')
  echo "$i len=${d}s mean/max=${vd} floor=${nf} peaks=${pc} start=${head} end=${tail}"
done
