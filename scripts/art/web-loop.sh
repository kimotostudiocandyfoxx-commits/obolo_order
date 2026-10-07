#!/usr/bin/env bash
# Art workshop: a Veo clip → a light, silent web loop for <video autoplay muted loop>.
# usage: scripts/art/web-loop.sh <in.mp4> <out.mp4> [crossfade-seconds]
#   crossfade: when the clip's end does not match its start, blend the end into the start so the
#   loop has no jump (not needed for clips made with loop: true).
set -euo pipefail
in=$1 out=$2 xf=${3:-0}
enc=(-an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -profile:v high -movflags +faststart -vf "scale=1280:-2")
if [[ "$xf" == "0" ]]; then
  ffmpeg -v error -y -i "$in" "${enc[@]}" "$out"
else
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
  ffmpeg -v error -y -i "$in" -i "$in" -filter_complex \
    "[0:v]trim=start=$xf,setpts=PTS-STARTPTS[a];[1:v]trim=end=$xf,setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=$xf:offset=$(python3 -c "print($d-2*$xf)"),scale=1280:-2[v]" \
    -map "[v]" -an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -profile:v high -movflags +faststart "$out"
fi
ls -la "$out"
