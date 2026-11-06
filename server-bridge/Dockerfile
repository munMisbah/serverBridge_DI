# ==============================================================================
# Multi-stage Dockerfile for Dynamic Island Server Bridge
# Produces a secure, minimal container image (~15MB)
# ==============================================================================

FROM rust:1.85-alpine AS builder

WORKDIR /app
RUN apk add --no-cache musl-dev

# Cache dependencies
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Build actual binary
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ==============================================================================
# Runner Image (Minimal Alpine)
# ==============================================================================
FROM alpine:3.21

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/target/release/di-server-bridge /usr/local/bin/di-server-bridge

EXPOSE 8765

ENV BRIDGE_PORT=8765
ENV RUST_LOG=info

ENTRYPOINT ["/usr/local/bin/di-server-bridge"]
