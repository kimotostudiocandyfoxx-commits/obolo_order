#!/usr/bin/env bash
# Converts an onboarding motion (any phone video) into the web delivery format:
#   1080x1920 H.264 (CRF 25, ≤4 Mbps) + AAC, faststart, plus a JPEG poster of the first frame.
# Usage: scripts/encode-onboarding.sh <input-video> <motion-number>
#   → apps/web/public/onboarding/m<N>.mp4 and m<N>.jpg
# PLACEHOLDER (P-OB-4): files are served from the web app for the demo; move to Bunny CDN later.
set -euo pipefail
in="$1"; n="$2"
out="$(dirname "$0")/../apps/web/public/onboarding"
mkdir -p "$out"
ffmpeg -v error -y -i "$in" -map 0:v:0 -map 0:a:0? \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -profile:v high -preset slow -crf 25 -maxrate 4M -bufsize 8M -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart "$out/m$n.mp4"
"$(dirname "$0")/normalize-audio.sh" "$out/m$n.mp4" -16
ffmpeg -v error -y -i "$out/m$n.mp4" -frames:v 1 -vf scale=540:-1 -q:v 4 "$out/m$n.jpg"
echo "m$n: $(du -h "$out/m$n.mp4" | cut -f1)"
