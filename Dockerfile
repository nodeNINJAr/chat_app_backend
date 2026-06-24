# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# argon2 runs a native build step on install — build tools only live in this stage.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build && pnpm prune --prod

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

RUN useradd --system --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /app/uploads-data \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["node", "dist/main.js"]
