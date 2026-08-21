FROM golang:1.22-alpine AS builder

# Install only required build dependencies
RUN apk add --no-cache --virtual .build-deps \
    git \
    bash \
    curl \
    ca-certificates \
    build-base \
    && update-ca-certificates

WORKDIR /build

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binaries with security flags
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
    go build -mod=mod -ldflags='-w -s -extldflags "-static"' \
    -o /app/polyorch-api ./cmd/api

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
    go build -mod=mod -ldflags='-w -s -extldflags "-static"' \
    -o /app/polyorch-worker ./cmd/worker

# Strip binaries to reduce attack surface
RUN strip /app/polyorch-api /app/polyorch-worker || true

# Build frontend
RUN if [ -d "web" ] && [ -f "web/package.json" ]; then \
        cd web && npm ci --no-audit --no-fund && npm run build; \
    fi

# Runtime stage - minimal image
FROM alpine:3.19

# Install only required packages
RUN apk add --no-cache \
    nats-server \
    python3 \
    nodejs \
    npm \
    bash \
    curl \
    ca-certificates \
    sqlite \
    supervisor \
    && update-ca-certificates

# Create non-root user for running processes
RUN addgroup -g 1000 -S polyorch && \
    adduser -u 1000 -S polyorch -G polyorch

# Create directories with proper ownership
RUN mkdir -p /data /app /tmp/runs /var/log/supervisord /var/run && \
    chown -R polyorch:polyorch /data /app /tmp/runs /var/log/supervisord /var/run

# Copy built binaries
COPY --from=builder --chown=polyorch:polyorch /app/polyorch-api /app/polyorch-api
COPY --from=builder --chown=polyorch:polyorch /app/polyorch-worker /app/polyorch-worker

# Copy configuration files
COPY --chown=polyorch:polyorch scripts/supervisord.conf /etc/supervisord.conf
COPY --chown=polyorch:polyorch scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copy frontend build if exists
RUN if [ -d "web/dist" ]; then \
        cp -r web/dist /app/web && chown -R polyorch:polyorch /app/web; \
    elif [ -d "web" ] && [ -f "web/package.json" ]; then \
        echo "Warning: web/dist not found. Run 'make build-frontend' first."; \
    fi

# Switch to non-root user
USER polyorch:polyorch

# Expose only necessary ports
EXPOSE 8080 4222

# Add security labels
LABEL maintainer="PolyOrch Maintainers"
LABEL description="PolyOrch - Polyglot DAG Orchestrator"
LABEL version="latest"
LABEL org.opencontainers.image.title="polyorch"
LABEL org.opencontainers.image.description="Lightweight polyglot DAG orchestrator"
LABEL org.opencontainers.image.vendor="PolyOrch"
LABEL org.opencontainers.image.licenses="MIT"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use exec form for proper signal handling
ENTRYPOINT ["/app/entrypoint.sh"]
