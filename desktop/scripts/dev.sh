#!/bin/bash
# Development script for desktop - starts backend and frontend with correct env vars

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "Starting development servers..."
echo "Project root: $PROJECT_ROOT"

# Set environment variables for SQLite development
export DATABASE_URL="file:$PROJECT_ROOT/backend/dev.db"
export PHOENIXD_URL="http://localhost:9740"
export PHOENIXD_PASSWORD=""
export FRONTEND_URL="http://localhost:3000"
export NEXT_PUBLIC_API_URL="http://localhost:4000"
export NEXT_PUBLIC_WS_URL="ws://localhost:4000"

cd "$PROJECT_ROOT/backend"

# Check if we need to switch to SQLite schema
if ! grep -q 'provider = "sqlite"' prisma/schema.prisma 2>/dev/null; then
    echo "Switching to SQLite schema for development..."
    if [ -f "prisma/schema.prisma" ] && [ ! -f "prisma/schema.prisma.bak" ]; then
        cp prisma/schema.prisma prisma/schema.prisma.bak
    fi
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
    npx prisma generate
fi

# Always ensure database is in sync
echo "Syncing database schema..."
npx prisma db push --accept-data-loss --skip-generate

# Start backend and frontend concurrently
cd "$PROJECT_ROOT"
npx concurrently \
    "cd backend && DATABASE_URL='file:$PROJECT_ROOT/backend/dev.db' PHOENIXD_URL='http://localhost:9740' FRONTEND_URL='http://localhost:3000' npm run dev" \
    "cd frontend && NEXT_PUBLIC_API_URL='http://localhost:4000' NEXT_PUBLIC_WS_URL='ws://localhost:4000' npm run dev"
