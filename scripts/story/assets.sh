#!/usr/bin/env bash
# Refresh the story asset list (public/story/assets.json, docs/story-import/assets.md) with the story
# chat's latest cast.md / places.md, without re-importing the scenes.
set -euo pipefail
BRANCH="${STORY_BRANCH:-claude/hopeful-pascal-udqkh2}"
TMP="$(mktemp -d)"
git fetch -q origin "$BRANCH" && git archive "origin/$BRANCH" docs/story-rewrite | tar -x -C "$TMP" || true
SHEETS="$TMP/docs/story-rewrite"
P01="$(find "$SHEETS" -type d -name P01 2>/dev/null | head -1)"
[ -n "$P01" ] && [ -f "$(dirname "$P01")/cast.md" ] && SHEETS="$(dirname "$P01")"
npx --yes tsx@4.19.2 apps/web/scripts/story-assets.ts "$SHEETS"
rm -rf "$TMP"
