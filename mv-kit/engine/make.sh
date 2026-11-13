#!/usr/bin/env bash
# MV kit — one command: project -> index.html -> frames -> MP4.
#   mv-kit/engine/make.sh <project-dir> [out.mp4]
# speed: "speed" in project.json or SPEED=1.2 (tempo up, pitch kept). Output default: <project>/out/MV.mp4 (or _<speed>x)
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
PRJ="$(cd "$1" && pwd)"
SPD="${SPEED:-$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('speed',1))" "$PRJ/project.json")}"
OUT="${2:-$PRJ/out/MV$( [ "$SPD" = "1" ] || echo "_${SPD}x" ).mp4}"
PORT="${PORT:-8795}"
python3 "$KIT/build.py" "$PRJ"
mkdir -p "$(dirname "$OUT")"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$PRJ" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html" && break; sleep 0.2; done
PROJECT="$PRJ" SPEED="$SPD" PORT="$PORT" node "$KIT/render.js" video "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
