# Achilles web app (Next.js standalone build).
# ACHILLES_API_URL and ACHILLES_API_KEY are read at runtime by the server-side proxy,
# so no key is ever baked into the image.
FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
# Same pnpm as package.json "packageManager". Corepack in Node 22 can't launch pnpm 12, so install it via npm.
RUN npm install -g pnpm@12.3.4

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 10001 achilles && adduser -S -u 10001 -G achilles achilles
COPY --from=build --chown=achilles:achilles /app/public ./public
COPY --from=build --chown=achilles:achilles /app/.next/standalone ./
COPY --from=build --chown=achilles:achilles /app/.next/static ./.next/static
USER achilles
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]
