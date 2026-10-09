#!/usr/bin/env bash
# Which Novita image routes exist now? (2026-10-09: /v3/async/txt2img answered 404 "route not found")
set -u
curl -sL --max-time 30 https://novita.ai/docs/llms-full.txt -o /tmp/full.txt; wc -c /tmp/full.txt
echo "== the Sep 30, 2026 notice"
grep -n -A40 "Sep 30, 2026 Multimodal Model Deprecation Notice" /tmp/full.txt | head -60
echo "== image API pages"
grep -oE "Source: https://docs.novita.ai/api-reference/model-apis-[a-z0-9-]*" /tmp/full.txt | grep -iE "img|image|seedream|flux|anime|lora|z-image" | sort -u
echo "== the routes those pages call"
grep -oE "https://api.novita.ai/v3/async/[a-z0-9_-]+" /tmp/full.txt | sort | uniq -c | sort -rn | head -60
echo "== z-image turbo page"
awk '/Source: https:\/\/docs.novita.ai\/api-reference\/model-apis-z-image/{p=1} p{print; n++} n>90{exit}' /tmp/full.txt
