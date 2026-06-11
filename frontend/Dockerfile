# frontend/Dockerfile
# Build context : ./frontend
# Multi-stage : deps → builder → runner

# ── Étape 1 : dépendances ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Installer les dépendances système nécessaires (sharp, etc.)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# ── Étape 2 : build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables d'env au build time
# NEXT_PUBLIC_* sont embarquées dans le bundle
ARG NEXT_PUBLIC_API_URL=http://localhost:9000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Désactiver la télémétrie Next.js
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Étape 3 : runner (image minimale) ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Créer un user non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copier les fichiers de build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -q --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
