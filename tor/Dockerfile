FROM alpine:3.19

# Install Tor
RUN apk add --no-cache tor curl && \
    rm -rf /var/cache/apk/*

# Create directories with proper permissions
RUN mkdir -p /var/lib/tor && \
    chown -R tor:tor /var/lib/tor && \
    chmod 700 /var/lib/tor

# Copy Tor configuration
COPY torrc /etc/tor/torrc

# Expose SOCKS5 proxy port
EXPOSE 9050

# Switch to tor user for security
USER tor

# Health check - verify Tor SOCKS5 is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl --socks5 localhost:9050 --connect-timeout 10 https://check.torproject.org/api/ip 2>/dev/null | grep -q '"IsTor":true' || exit 1

# Start Tor
CMD ["tor", "-f", "/etc/tor/torrc"]
