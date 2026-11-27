# Cloud Run image for the API (build context = repository root).
#   docker build -f apps/api/Dockerfile -t obolo-api .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter "@obolo/api..."
RUN pnpm --filter "@obolo/api..." build
RUN pnpm --filter @obolo/api deploy --prod --legacy /out

FROM node:22-slim
# ffmpeg re-encodes uploaded videos to 720p / ~1.5 Mbps (docs/media.md) and renders Mars MVs;
# the CJK font is for the lyrics burnt onto MVs; heif-convert turns iPhone HEIC pictures (Bluena's clip) into JPEG
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk libheif-examples && rm -rf /var/lib/apt/lists/*
# client 2026-11-27 (sample K, src/voice/voice-mix.ts): the light pitch correction of a ダチ voice message is Praat
# (praat-parselmouth, a wheel: nothing is compiled) run as a subprocess — its own small Python environment.
# ffmpeg's rubberband filter (the speed and the key) is part of Debian's ffmpeg (the build log says so below); without
# it the chain uses asetrate + atempo by itself. The clean-up's RNNoise step is ffmpeg's arnndn filter with the model in
# apps/api/assets/voice-clean (shipped with the other assets); without the filter the chain cleans the way of before.
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv \
  && python3 -m venv /opt/voice \
  && /opt/voice/bin/pip install --no-cache-dir praat-parselmouth==0.4.7 \
  && /opt/voice/bin/python -c "import parselmouth" \
  && (ffmpeg -hide_banner -filters | grep rubberband || echo "NOTE: this ffmpeg has no rubberband filter - the voice chain uses asetrate + atempo") \
  && (ffmpeg -hide_banner -filters | grep arnndn || echo "NOTE: this ffmpeg has no arnndn filter - the voice chain cleans without RNNoise") \
  && rm -rf /var/lib/apt/lists/* /root/.cache
ENV VOICE_TUNE_PYTHON=/opt/voice/bin/python
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
USER node
EXPOSE 8080
# Same image runs the queue worker with: node dist/worker.js
CMD ["node", "dist/main.js"]
