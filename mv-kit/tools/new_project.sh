#!/usr/bin/env bash
# Start a new MV project folder from the example (keep it OUTSIDE any public repository).
#   bash mv-kit/tools/new_project.sh ~/mv-projects/my-song /path/to/song.mp3
set -euo pipefail
KIT="$(cd "$(dirname "$0")/.." && pwd)"; PRJ="$1"
[ -e "$PRJ/project.json" ] && { echo "already exists: $PRJ/project.json"; exit 1; }
mkdir -p "$PRJ"/{art,layers,work,qa,out}
cp "$KIT/example/project.json" "$PRJ/project.json"
[ -n "${2:-}" ] && cp "$2" "$PRJ/song.mp3"
echo "project ready: $PRJ  (next: MANUAL.md step 1)"
