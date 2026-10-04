#!/usr/bin/env bash
# Two-pass EBU R128 loudness normalisation of a media file's audio (video stream is copied untouched).
# Usage: scripts/normalize-audio.sh <file> [target LUFS, default -16]
# Targets (PLACEHOLDER P-OB-8, tune by ear): motions -16 LUFS, BGM -16 LUFS (mixed at BGM_VOLUME).
set -euo pipefail
f="$1"; target="${2:--16}"; tp=-1.5; lra=11
if ! ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | grep -q .; then
  echo "$(basename "$f"): no audio, skipped"; exit 0
fi
stats=$(ffmpeg -hide_banner -nostats -i "$f" -vn -af "loudnorm=I=$target:TP=$tp:LRA=$lra:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }
in_i=$(get input_i)
# Silent tracks (e.g. a motion with an empty audio track) are left alone.
if [[ "$in_i" == "-inf" ]] || awk "BEGIN{exit !($in_i < -60)}"; then echo "$(basename "$f"): silent ($in_i LUFS), skipped"; exit 0; fi
filter="loudnorm=I=$target:TP=$tp:LRA=$lra:measured_I=$in_i:measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
tmp="${f%.*}.norm.${f##*.}"
if [[ "$f" == *.mp4 ]]; then
  ffmpeg -v error -y -i "$f" -map 0:v:0 -map 0:a:0 -c:v copy -af "$filter" -ar 48000 -c:a aac -b:a 128k -movflags +faststart "$tmp"
else
  ffmpeg -v error -y -i "$f" -vn -af "$filter" -ar 48000 -c:a aac -b:a 128k -movflags +faststart "$tmp"
fi
mv "$tmp" "$f"
echo "$(basename "$f"): $in_i → $target LUFS"
