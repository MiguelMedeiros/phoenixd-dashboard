#!/bin/sh
set -e

# Check if token is provided
if [ -z "$TUNNEL_TOKEN" ]; then
    echo "Error: TUNNEL_TOKEN environment variable is required"
    exit 1
fi

echo "Starting Cloudflare Tunnel..."

# Run cloudflared with the provided token
exec cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN"
