#!/bin/sh
set -e

echo "Starting Tailscale daemon..."

# Start tailscaled in userspace networking mode
tailscaled --tun=userspace-networking --statedir=/var/lib/tailscale &

# Wait for tailscaled to be ready
sleep 3

# Check if already authenticated
if tailscale status --json 2>/dev/null | jq -e '.Self.Online == true' > /dev/null 2>&1; then
    echo "Tailscale already authenticated and online"
else
    echo "Authenticating with Tailscale..."
    
    if [ -z "$TS_AUTHKEY" ]; then
        echo "ERROR: TS_AUTHKEY environment variable is required"
        exit 1
    fi
    
    # Authenticate with the provided auth key
    tailscale up \
        --authkey="$TS_AUTHKEY" \
        --hostname="${TS_HOSTNAME:-phoenixd-dashboard}" \
        --accept-dns=true \
        --accept-routes=true
    
    echo "Tailscale authenticated successfully!"
fi

# Wait a moment for connection to stabilize
sleep 2

# Get the full Magic DNS name
MAGIC_DNS=$(tailscale status --json | jq -r '.Self.DNSName' | sed 's/\.$//')
echo ""
echo "========================================"
echo "Magic DNS Hostname: $MAGIC_DNS"
echo "========================================"

# Configure Tailscale Serve to proxy frontend and backend
echo ""
echo "Configuring Tailscale Serve..."

# Reset any existing serve configuration
tailscale serve reset 2>/dev/null || true

# Serve frontend on HTTPS default port (443)
echo "Setting up frontend proxy (port 443 -> frontend:3000)..."
tailscale serve --bg http://phoenixd-frontend:3000 || {
    echo "Warning: Frontend serve setup failed"
}

# Serve backend on port 4001
# This allows the frontend to make API calls to https://magic-dns:4001/api/*
echo "Setting up backend proxy (port 4001 -> backend:4000)..."
tailscale serve --bg --https 4001 http://phoenixd-backend:4000 || {
    echo "Warning: Backend serve setup failed, trying alternative syntax..."
    # Try alternative syntax for older versions
    tailscale serve --set-path /api --bg --https 4001 http://phoenixd-backend:4000 2>/dev/null || true
}

# Show serve status
echo ""
echo "Tailscale Serve Status:"
tailscale serve status 2>/dev/null || echo "(serve status not available)"

echo ""
echo "========================================"
echo "Remote Access URLs (via Tailscale):"
echo "========================================"
echo ""
echo "Dashboard: https://$MAGIC_DNS"
echo "API:       https://$MAGIC_DNS:4001"
echo ""
echo "========================================"
echo ""
echo "Install Tailscale on your phone and access the dashboard!"
echo ""

# Keep the container running
wait
