#!/usr/bin/env bash
# Production UI 7 (2026-10-15): story videos are 720×1280 and at most 1 MB each.
# Re-encodes the given motions in place (two-pass H.264 to a size budget + 64 kbps AAC, faststart):
#   scripts/shrink-onboarding.sh apps/web/public/onboarding/m1.mp4 …
set -euo pipefail
BUDGET_KB=${BUDGET_KB:-960}
for f in "$@"; do
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  hasa=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | head -1)
  akbps=$([ -n "$hasa" ] && echo 64 || echo 0)
  vk=$(python3 -c "print(max(250, int($BUDGET_KB*8/$dur - $akbps - 12)))")
  tmp="$(mktemp -d)"
  vf="scale=720:1280:force_original_aspect_ratio=decrease:flags=lanczos,pad=720:1280:(ow-iw)/2:(oh-ih)/2"
  ffmpeg -v error -y -i "$f" -vf "$vf" -c:v libx264 -preset slow -b:v ${vk}k -pass 1 -passlogfile "$tmp/p" -an -f mp4 /dev/null
  if [ -n "$hasa" ]; then a=(-c:a aac -b:a 64k); else a=(-an); fi
  ffmpeg -v error -y -i "$f" -vf "$vf" -c:v libx264 -preset slow -b:v ${vk}k -pass 2 -passlogfile "$tmp/p" -pix_fmt yuv420p -profile:v high "${a[@]}" -movflags +faststart "$tmp/out.mp4"
  mv "$tmp/out.mp4" "$f"; rm -rf "$tmp"
  echo "$(basename "$f"): $(du -k "$f" | cut -f1) KB (${vk} kbps)"
done
