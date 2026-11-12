# Eleventory storefront + admin (Next.js standalone) for Railway or any Docker host.
# NEXT_PUBLIC_* values are baked in at build time, so they are build args.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
# Multi-store mode: next.config.ts reads these at build time (rewrites), the proxy at run time.
ARG MULTI_STORE=false
ARG PLATFORM_HOSTS=
ARG PLATFORM_LANDING=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    MULTI_STORE=$MULTI_STORE \
    PLATFORM_HOSTS=$PLATFORM_HOSTS \
    PLATFORM_LANDING=$PLATFORM_LANDING \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
# Railway injects PORT; the standalone server reads it.
CMD ["node", "server.js"]
