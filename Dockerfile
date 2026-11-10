# syntax=docker/dockerfile:1.4
# Use the official Node.js 22 LTS image as base (เหมือน wms-frontend)
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Configure npm for better network reliability and performance
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 15 && \
    npm config set prefer-offline true

# Install dependencies with cache mount for npm cache
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then \
    npm ci --prefer-offline --no-audit --maxsockets=15 || \
    (echo "First attempt failed, retrying..." && sleep 5 && npm ci --prefer-offline --no-audit --maxsockets=15) || \
    (echo "Second attempt failed, retrying with network..." && sleep 10 && npm ci --no-audit --maxsockets=15); \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build with cache mount for Next.js cache
RUN --mount=type=cache,target=/app/.next/cache \
  npm run build

# Production image — standalone output (next.config: output: 'standalone')
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set timezone to Asia/Bangkok (UTC+7)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Bangkok
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone = server.js + node_modules ที่ trace แล้ว
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# static assets + public ไม่ได้รวมอยู่ใน standalone → ต้อง copy แยก
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 4101

ENV PORT=4101
ENV HOSTNAME="0.0.0.0"

# standalone รันด้วย node server.js ตรงๆ
CMD ["node", "server.js"]
