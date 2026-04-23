# Denali Health — Next.js Production Dockerfile
# Multi-stage build: deps → builder → runner
# Target: AWS ECS Fargate (linux/amd64)

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS base

# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
# Use npm ci for reproducible installs from lockfile
RUN npm ci --include=dev

# ── Stage 2: Build the Next.js app ────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry — disable for production builds
ENV NEXT_TELEMETRY_DISABLED=1

# Build args for NEXT_PUBLIC_* vars (set at build time, baked into bundle)
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL=https://denali.health
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy service worker (must stay in public/)
COPY --from=builder /app/public/sw.js ./public/sw.js

# Copy RDS CA bundle for TLS certificate validation (HIPAA requirement)
COPY --from=builder /app/certs/rds-global-bundle.pem ./certs/rds-global-bundle.pem

USER nextjs

EXPOSE 3000

# Health check — uses Node.js (always available) instead of wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
