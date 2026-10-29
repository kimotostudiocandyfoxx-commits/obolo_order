#!/usr/bin/env bash
# Rebuild every story character's layers (scripts/sprite-layers.py) with each cast's settings —
# run after the layer script changes or a cast's pictures are redrawn.
#   scripts/sprite-layers-all.sh [stem-prefix …]   (default: all)
set -uo pipefail
S=apps/web/public/onboarding/s
O=apps/web/public/onboarding
args_for() {
  case "$1" in
    freezy-x-*) echo "--no-eyes --face 0.12,0.42" ;;
    kaiser1-x-*) echo "--no-eyes --face 0.22,0.58" ;;
    unchi-pinpon-x-*) echo "--face 0.4,0.8" ;;
    kimorin-i-* | kimorin-xs-*) echo "--no-eyes" ;;
    # the eye glow from the pose itself (M-R177: the -glow edits had redrawn the face)
    kimorin-*) echo "--eyes-from-base" ;;
    *) echo "--no-eyes" ;;
  esac
}
stems=$(python3 -c "import json;print(' '.join(sorted(json.load(open('apps/web/lib/story/sprite-layers.json')))))")
for st in $stems; do
  if [ $# -gt 0 ]; then ok=0; for p in "$@"; do [[ $st == $p* ]] && ok=1; done; [ $ok = 1 ] || continue; fi
  [ -f "$S/$st.jpg" ] || { echo "skip $st (no picture)"; continue; }
  python3 scripts/sprite-layers.py "$S" "$O" "$st" $(args_for "$st") >/dev/null 2>&1 && echo "ok $st" || echo "FAIL $st"
done
