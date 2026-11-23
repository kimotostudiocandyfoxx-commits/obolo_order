#!/bin/sh
# Puts the current branch head on production (web on Vercel and the API on Cloud Run).
# Usage: scripts/release.sh "what is in it"
# Everything pushed before this stays off production until the next release (the pin, 2026-11-23).
set -e
cd "$(git rev-parse --show-toplevel)"
BRANCH=claude/solar-system-home-planets-ew766y
NOTE="${1:-release}"
git pull -q --rebase --autostash origin "$BRANCH"
N=$(grep -c '^- R' RELEASE.md 2>/dev/null || echo 0); N=$((N + 1))
[ -f RELEASE.md ] || printf '# 本番に出した版\n\n本番（Web と API）は、ここに書いた版だけが出る。出し方は `scripts/release.sh "中身"`。\n\n' > RELEASE.md
printf -- '- R%s %s %s — %s\n' "$N" "$(date -u +%Y-%m-%dT%H:%MZ)" "$(git rev-parse --short HEAD)" "$NOTE" >> RELEASE.md
git add RELEASE.md
git commit -q -m "Release R$N: $NOTE [release]"
git push -q origin "HEAD:$BRANCH"
echo "R$N pushed"
