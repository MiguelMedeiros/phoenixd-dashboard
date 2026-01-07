FROM cloudflare/cloudflared:latest

# The cloudflared image is scratch-based and runs cloudflared directly
# We use the --token flag to authenticate with Cloudflare

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/cloudflared tunnel info || exit 1

# Use the tunnel run command with token passed via environment
ENTRYPOINT ["/usr/local/bin/cloudflared", "tunnel", "--no-autoupdate", "run", "--token"]
CMD [""]
