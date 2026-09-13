# Multi-stage build for the @debtmaster/web app (TanStack Start).
# Build context = repo ROOT (so Bun can resolve workspaces + patches).
# The app source lives under apps/web; packages/core is a workspace dependency.

# Build stage - Pin to Bun 1.4.0 (matches CI setup-bun + local dev)
FROM oven/bun:1.4.0-debian AS builder

# Install OpenSSL and other build dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests + lockfile + patches first for better layer caching.
# All workspace package.json files must be present so `bun install` can resolve
# the workspace graph before any source is copied.
COPY package.json bun.lock* ./
COPY tsconfig.base.json ./tsconfig.base.json
COPY patches ./patches
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/core/package.json ./packages/core/package.json

# Disable husky prepare script during builder install
ENV HUSKY=0
# Install all dependencies (including dev dependencies for build)
RUN bun install --frozen-lockfile

# Copy the web app source + the core workspace source
COPY apps/web ./apps/web
COPY packages/core ./packages/core

# Build runs from the web workspace (configs + relative paths live there)
WORKDIR /app/apps/web

# Set Prisma environment variables for build
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x"
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="true"
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Generate Prisma client (for build stage only - output will be copied from prod-deps)
RUN bunx prisma generate

# Build the application
RUN bun run build

# Install only production dependencies in a clean directory with optimizations.
# Mirror the workspace layout so Bun resolves prod deps for @debtmaster/web.
RUN mkdir /prod-deps && cd /prod-deps && \
    cp /app/package.json . && \
    cp /app/bun.lock* . && \
    cp -r /app/patches ./patches && \
    mkdir -p apps/web apps/mobile packages/core && \
    cp /app/apps/web/package.json ./apps/web/package.json && \
    cp /app/apps/mobile/package.json ./apps/mobile/package.json && \
    cp /app/packages/core/package.json ./packages/core/package.json && \
    cp -r /app/apps/web/prisma ./apps/web/prisma && \
    cp /app/apps/web/prisma.config.ts ./apps/web/prisma.config.ts && \
    HUSKY=0 NODE_ENV=production bun install --frozen-lockfile --production --no-optional --ignore-scripts && \
    cd apps/web && bunx prisma generate && \
    cd /prod-deps && bun pm cache rm && \
    # Remove unnecessary files from node_modules
    find node_modules -name "*.md" -type f -delete && \
    find node_modules -name "LICENSE*" -type f -delete && \
    find node_modules -name "CHANGELOG*" -type f -delete && \
    find node_modules -name "*.map" -type f -delete && \
    find node_modules -name "*.d.ts" -type f -delete && \
    find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "example*" -type d -exec rm -rf {} + 2>/dev/null || true

# Production runtime stage - Ultra lightweight with Bun
FROM oven/bun:1.4.0-alpine AS runtime

# Install only essential runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    openssl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# --- Preserve Bun's workspace node_modules layout ---
# Bun installs workspace deps as symlinks under apps/web/node_modules that point into
# the shared root node_modules/.bun store. Copy BOTH layers so the symlinks stay valid
# (the runtime serves the app from apps/web, where these deps are resolvable). The
# generated Prisma client ships inside the .bun store from the prod-deps generate, so
# no runtime prisma generate is needed.
COPY --from=builder --chown=nodejs:nodejs /prod-deps/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /prod-deps/apps/web/node_modules ./apps/web/node_modules

# Workspace manifests (apps/web/package.json is read by `bun run` / `bun x` at runtime)
COPY --from=builder --chown=nodejs:nodejs /prod-deps/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /prod-deps/apps/web/package.json ./apps/web/package.json

# Built output (vite build produced apps/web/dist in the builder stage)
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/dist ./apps/web/dist

# Prisma schema / migrations / config (migrate.sh runs `prisma migrate deploy` from apps/web)
COPY --from=builder --chown=nodejs:nodejs /prod-deps/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nodejs:nodejs /prod-deps/apps/web/prisma.config.ts ./apps/web/prisma.config.ts

# App scripts (server.ts, migrate.sh, entrypoint.sh)
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/scripts ./apps/web/scripts
RUN chmod +x ./apps/web/scripts/migrate.sh ./apps/web/scripts/entrypoint.sh

# Aggressive cleanup for minimal size (run from /app before switching WORKDIR)
RUN rm -rf /tmp/* /var/cache/apk/* && \
    find . -name "*.map" -type f -delete && \
    find . -name "*.d.ts" -type f -delete && \
    find . -name "*.test.*" -type f -delete && \
    find . -name "*.spec.*" -type f -delete && \
    find ./node_modules -name "*.md" -type f -delete 2>/dev/null || true && \
    find ./node_modules -name "README*" -type f -delete 2>/dev/null || true

# The app runs from the web workspace: scripts/, prisma/, and dist/ are all relative to apps/web
WORKDIR /app/apps/web

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Minimal health check with Bun
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Set the entrypoint (relative to WORKDIR /app/apps/web)
ENTRYPOINT ["./scripts/entrypoint.sh"]

# Default to running the app
CMD ["app"]
