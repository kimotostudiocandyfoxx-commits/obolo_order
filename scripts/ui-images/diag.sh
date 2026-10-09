#!/usr/bin/env bash
# Which Novita routes exist now? (2026-10-09: /v3/async/txt2img answered 404 "route not found")
set -u
echo "== docs index: text-to-image related pages"
curl -sL --max-time 30 https://novita.ai/docs/llms.txt | grep -iE "txt2img|text.to.image|img2img|image.to.image|stable diffusion|sdxl|checkpoint|deprecat" | head -60
for u in https://docs.novita.ai/llms.txt; do echo "== $u"; curl -sL --max-time 30 "$u" | grep -iE "txt2img|text.to.image|img2img|sdxl|deprecat" | head -40; done
echo "== probe routes (status, body head)"
for path in v3/async/txt2img v3/async/img2img v3/async/sdxl-txt2img v3/async/sd-txt2img v2/txt2img v3/async/flux-1-schnell v3/async/seedream-3-0-txt2img v3/async/z-image-turbo; do
  code=$(curl -s -o /tmp/b -w '%{http_code}' --max-time 30 -X POST "https://api.novita.ai/$path" -H "Authorization: Bearer $NOVITA_API_KEY" -H 'content-type: application/json' -d '{}')
  echo "$path → $code $(head -c 160 /tmp/b)"
done
echo "== the txt2img reference page"
curl -sL --max-time 30 https://novita.ai/docs/api-reference/model-apis-txt2img.md | head -60
