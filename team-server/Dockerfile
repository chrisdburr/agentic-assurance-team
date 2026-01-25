# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 2: Runtime
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Create data directory
RUN mkdir -p /.agents && chown appuser:appgroup /.agents

# Switch to non-root user
USER appuser

# Environment defaults
ENV WEB_PORT=3030
ENV DB_PATH=/.agents/team.db

EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3030/api/health || exit 1

CMD ["bun", "run", "src/index.ts"]
