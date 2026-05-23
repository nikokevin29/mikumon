FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies from monorepo root
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validation/package.json ./packages/validation/
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validation/package.json ./packages/validation/
RUN bun install --frozen-lockfile
COPY apps/api ./apps/api
COPY packages ./packages
RUN cd apps/api && bun build src/index.ts --target bun --outdir dist

# Production runner
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3001
CMD ["bun", "run", "dist/index.js"]
