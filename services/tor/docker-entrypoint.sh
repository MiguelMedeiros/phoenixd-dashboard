#!/bin/bash
set -e

echo "Starting Tor service..."

# Ensure correct permissions on hidden service directory
if [ -d "/var/lib/tor/hidden_service" ]; then
    chmod 700 /var/lib/tor/hidden_service
fi

# Start Tor
exec tor -f /etc/tor/torrc
