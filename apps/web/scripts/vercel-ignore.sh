#!/bin/sh
# Vercel "Ignored Build Step" (exit 0 = skip, exit 1 = build).
# The launch version is pinned (2026-11-23): production is rebuilt only when the pushed commit says [release]
# (scripts/release.sh). Preview builds are not gated. Set RELEASE_GATE=off in Vercel to build every push again.
[ "$VERCEL_ENV" != "production" ] && exit 1
[ "$RELEASE_GATE" = "off" ] && exit 1
# only a real release commit (scripts/release.sh writes the subject "Release R<N>: … [release]"); the word alone in a message is not enough
git log -1 --pretty=%s | grep -Eq '^Release R[0-9]+: .*\[release\]$' && exit 1
echo "Not a release commit: production stays on the last release."
exit 0
