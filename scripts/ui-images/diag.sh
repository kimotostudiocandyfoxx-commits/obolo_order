#!/usr/bin/env bash
# Which Novita routes exist now? (2026-10-09: /v3/async/txt2img answered 404 "route not found")
set -u
echo "== end-of-service page (text)"
curl -sL --max-time 30 https://novita.ai/models/end-of-service | sed -e 's/<[^>]*>/ /g' | tr -s ' \n' | grep -ioE ".{0,120}(image|txt2img|img2img|stable diffusion|checkpoint).{0,160}" | head -40
echo "== docs index: every image page"
curl -sL --max-time 30 https://novita.ai/docs/llms.txt -o /tmp/llms.txt; wc -c /tmp/llms.txt
grep -iE "image|img|anime|lora|checkpoint|deprecat|end of service" /tmp/llms.txt | head -120
echo "== changelog lines about image"
curl -sL --max-time 30 https://novita.ai/docs/llms-full.txt -o /tmp/full.txt; wc -c /tmp/full.txt
grep -ioE ".{0,100}(txt2img|img2img|end of service|deprecat|discontinu).{0,160}" /tmp/full.txt | head -60
echo "== probe routes (status, body head)"
for path in v3/async/txt2img v3/async/qwen-image-txt2img v3/async/qwen-image-edit v3/async/seedream-4-0 v3/async/flux-1-kontext-dev v3/async/hunyuan-image-3; do
  code=$(curl -s -o /tmp/b -w '%{http_code}' --max-time 30 -X POST "https://api.novita.ai/$path" -H "Authorization: Bearer $NOVITA_API_KEY" -H 'content-type: application/json' -d '{}')
  echo "$path → $code $(head -c 160 /tmp/b)"
done
