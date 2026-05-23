FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
RUN pnpm install --frozen-lockfile --prod

# Build stage
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types
COPY packages/validation ./packages/validation
RUN cd apps/web && pnpm build

# Production runner
FROM node:20-alpine AS runner
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
