FROM tailscale/tailscale:latest

# Install curl for healthchecks
RUN apk add --no-cache curl jq

# Create state directory
RUN mkdir -p /var/lib/tailscale

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose no ports - Tailscale handles networking via userspace networking

# Health check - verify Tailscale is connected
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD tailscale status --json | jq -e '.Self.Online == true' || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
