#!/usr/bin/env bash
# enc.sh in.wav out.m4a — two-pass EBU R128 to -16 LUFS (linear gain), AAC 128 kbps, 48 kHz
set -euo pipefail
in="$1"; out="$2"
stats=$(ffmpeg -hide_banner -nostats -i "$in" -af "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }
f="loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true"
ffmpeg -v error -y -i "$in" -af "$f" -ar 48000 -c:a aac -b:a 128k -movflags +faststart "$out"
ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '
ffprobe -v error -show_entries format=duration -of csv=p=0 "$out"
