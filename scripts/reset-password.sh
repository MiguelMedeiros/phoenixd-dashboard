#!/bin/bash

# Phoenixd Dashboard - Password Reset Script
# This script removes the password protection from the dashboard
# Use this if you forgot your password

set -e

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "🔐 Phoenixd Dashboard - Password Reset"
echo "======================================="
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if the postgres container is running
if ! docker ps --format '{{.Names}}' | grep -q "phoenixd-postgres"; then
    echo "❌ PostgreSQL container (phoenixd-postgres) is not running."
    echo "   Run 'docker compose up -d' first."
    exit 1
fi

echo "⚠️  This will remove the password protection from your dashboard."
echo "   You will need to set up a new password in Settings after this."
echo ""
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled."
    exit 0
fi

echo ""
echo "🔄 Resetting password..."

# Execute SQL to remove password
docker exec phoenixd-postgres psql -U phoenixd -d phoenixd_dashboard -c \
    "UPDATE \"Settings\" SET \"passwordHash\" = NULL WHERE id = 'singleton';" \
    > /dev/null 2>&1

# Check if the update was successful
result=$(docker exec phoenixd-postgres psql -U phoenixd -d phoenixd_dashboard -t -c \
    "SELECT CASE WHEN \"passwordHash\" IS NULL THEN 'success' ELSE 'failed' END FROM \"Settings\" WHERE id = 'singleton';" \
    2>/dev/null | tr -d ' \n')

if [ "$result" = "success" ]; then
    echo "✅ Password removed successfully!"
    echo ""
    echo "You can now access your dashboard without a password."
    echo "Go to Settings to set up a new password if needed."
else
    # Maybe Settings row doesn't exist yet, which is fine
    echo "✅ Done! No password is configured."
    echo ""
    echo "You can access your dashboard and set up a password in Settings."
fi
