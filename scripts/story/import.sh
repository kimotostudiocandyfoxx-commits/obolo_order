#!/usr/bin/env bash
# Story import: the story chat's latest Markdown (its branch) → the player's scenes + the report,
# then the asset list (people, places, sounds, tunes — with the story chat's cast.md / places.md).
#   scripts/story/import.sh [branch]   (default: the story chat's branch)
# Then commit apps/web/public/story/ and docs/story-import/ (the reports tell what to fix and make).
set -euo pipefail
BRANCH="${1:-claude/hopeful-pascal-udqkh2}"
TMP="$(mktemp -d)"
git fetch -q origin "$BRANCH"
git archive "origin/$BRANCH" docs/story-rewrite | tar -x -C "$TMP"
DIR="$(dirname "$(find "$TMP/docs/story-rewrite" -type d -name P01 | head -1)")"
npx --yes tsx@4.19.2 apps/web/scripts/story-import.ts "$DIR" "$BRANCH の ${DIR#$TMP/}"
# cast.md / places.md: next to the parts, or one level up (docs/story-rewrite/)
SHEETS="$DIR"; [ -f "$SHEETS/cast.md" ] || SHEETS="$TMP/docs/story-rewrite"
npx --yes tsx@4.19.2 apps/web/scripts/story-assets.ts "$SHEETS"
# the lines with members' names in them, for the server to voice per member
npx --yes tsx@4.19.2 apps/web/scripts/story-voices.ts --names-only
rm -rf "$TMP"
