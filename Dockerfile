FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM base AS build
# NEXT_PUBLIC_* vars are inlined at build time — pass them as build args.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN --mount=type=cache,target=/app/.next/cache bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src/db ./src/db
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
# Run pending migrations, then serve.
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run start"]
