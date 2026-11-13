#!/usr/bin/env bash
# MV kit — check pictures without rendering the whole film.
#   mv-kit/engine/qa.sh <project-dir> <name> 12,27.5,46     -> <project>/qa/<name>/t*.jpg + <project>/qa/<name>.jpg (contact sheet)
# times are song seconds (the original tempo). Run build.py first when project.json changed (this script does it).
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
PRJ="$(cd "$1" && pwd)"; NAME="$2"; TIMES="$3"; PORT="${PORT:-8795}"
python3 "$KIT/build.py" "$PRJ" >/dev/null
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$PRJ" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html" && break; sleep 0.2; done
PROJECT="$PRJ" PORT="$PORT" node "$KIT/render.js" stills "$PRJ/qa/$NAME" "$TIMES"
python3 "$KIT/sheet.py" "$PRJ/qa/$NAME" "$PRJ/qa/$NAME.jpg" 4 400
