#!/usr/bin/env bash
# Day 2 told with pictures (client 2026-11-28): the new sound effects as made by Seed Audio (design/story-audio-queue.json)
# are longer than their cue and some carry a second take after a gap — each is cut to its part, faded, and its peak set
# to −1.5 dBFS. The made file is kept once as design/sfx-src/se-<id>.mp3 (the source), the cut one replaces
# apps/web/public/onboarding/se-<id>.mp3. Run again after a remake: it starts from the new file when the source is older.
#   scripts/rocket/master-se.sh [id …]
set -euo pipefail
cd "$(dirname "$0")/../.."
O=apps/web/public/onboarding
mkdir -p design/sfx-src
# id → ffmpeg filter (start, length and fades in seconds)
declare -A F=(
  [whip]="atrim=0.35:1.25,asetpts=N/SR/TB,afade=t=in:d=0.02,afade=t=out:st=0.6:d=0.3"
  [glint]="atrim=0:1.0,asetpts=N/SR/TB,afade=t=out:st=0.75:d=0.25"
  [stone-door]="atrim=0:9,asetpts=N/SR/TB,afade=t=in:d=0.05,afade=t=out:st=6.8:d=2.2"
  [steps-hall]="atrim=0:6,asetpts=N/SR/TB,afade=t=in:d=0.05,afade=t=out:st=4.8:d=1.2"
  [hall-reveal]="atrim=0:8,asetpts=N/SR/TB,afade=t=in:d=0.3,afade=t=out:st=5.5:d=2.5"
  [star-sky]="atrim=0:8,asetpts=N/SR/TB,afade=t=in:d=0.3,afade=t=out:st=5:d=3"
  [streak-up]="atrim=0:2.6,asetpts=N/SR/TB,afade=t=in:d=0.02,afade=t=out:st=1.6:d=1"
  [zoom-back]="afade=t=in:d=0.05,afade=t=out:st=3.9:d=0.35"
  [gem-hum]="atrim=0:5,asetpts=N/SR/TB,afade=t=in:d=0.2,afade=t=out:st=3.5:d=1.5"
  [dissolve]="atrim=0:4.5,asetpts=N/SR/TB,afade=t=in:d=0.1,afade=t=out:st=2.5:d=2"
  [into-light]="atrim=0:5,asetpts=N/SR/TB,afade=t=in:d=0.05,afade=t=out:st=3.5:d=1.5"
)
# the pillar of light: the shimmer of the first take, then the impact of the second (the gap between them cut out)
BEAM="[0:a]atrim=0:2.8,asetpts=N/SR/TB,afade=t=out:st=2.4:d=0.4[a];[0:a]atrim=8.35:13,asetpts=N/SR/TB,afade=t=in:d=0.03[b];[a][b]acrossfade=d=0.15[o]"
ids=("$@")
[ ${#ids[@]} -gt 0 ] || ids=(whip glint stone-door steps-hall hall-reveal beam star-sky streak-up zoom-back gem-hum dissolve into-light)
for i in "${ids[@]}"; do
  out="$O/se-$i.mp3"; src="design/sfx-src/se-$i.mp3"
  [ -f "$out" ] || { echo "$i: no file yet"; continue; }
  # the file on the site is the made one (never cut, or a remake) unless its sum is the one this script wrote last
  last=$(grep "^$i " design/sfx-src/cut.sums 2>/dev/null | awk '{print $2}' || true)
  if [ ! -f "$src" ] || [ "$(md5sum < "$out" | cut -c1-32)" != "$last" ]; then cp "$out" "$src"; fi
  tmp=$(mktemp --suffix=.wav)
  if [ "$i" = beam ]; then ffmpeg -v error -y -i "$src" -filter_complex "$BEAM" -map "[o]" -ac 1 "$tmp"
  else ffmpeg -v error -y -i "$src" -af "${F[$i]}" -ac 1 "$tmp"; fi
  peak=$(ffmpeg -hide_banner -i "$tmp" -af volumedetect -f null - 2>&1 | grep max_volume | awk '{print $5}')
  gain=$(echo "-1.5 - ($peak)" | bc -l)
  ffmpeg -v error -y -i "$tmp" -af "volume=${gain}dB" -ac 1 -ar 44100 -b:a 128k "$out"
  { grep -v "^$i " design/sfx-src/cut.sums 2>/dev/null || true; echo "$i $(md5sum < "$out" | cut -c1-32)"; } > design/sfx-src/cut.sums.new && mv design/sfx-src/cut.sums.new design/sfx-src/cut.sums
  rm -f "$tmp"
  echo "$i: peak $peak → -1.5 dB, $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out") s"
done
