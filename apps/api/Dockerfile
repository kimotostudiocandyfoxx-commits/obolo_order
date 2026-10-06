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
# ffmpeg re-encodes uploaded videos to 720p / ~1.5 Mbps (docs/media.md)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
USER node
EXPOSE 8080
# Same image runs the queue worker with: node dist/worker.js
CMD ["node", "dist/main.js"]
