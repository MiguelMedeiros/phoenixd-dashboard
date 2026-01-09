#!/bin/bash
# Prepare backend for desktop mode (SQLite)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PRISMA_DIR="$BACKEND_DIR/prisma"

echo "Preparing backend for desktop mode..."

# Backup original schema
if [ -f "$PRISMA_DIR/schema.prisma.bak" ]; then
  echo "Restoring original schema from backup..."
  cp "$PRISMA_DIR/schema.prisma.bak" "$PRISMA_DIR/schema.prisma"
fi

# Create backup of original schema
cp "$PRISMA_DIR/schema.prisma" "$PRISMA_DIR/schema.prisma.bak"

# Use SQLite schema
echo "Switching to SQLite schema..."
cp "$PRISMA_DIR/schema.sqlite.prisma" "$PRISMA_DIR/schema.prisma"

# Generate Prisma client for SQLite
echo "Generating Prisma client for SQLite..."
cd "$BACKEND_DIR"
npx prisma generate

echo "Desktop preparation complete!"
echo ""
echo "To restore PostgreSQL schema, run:"
echo "  cp $PRISMA_DIR/schema.prisma.bak $PRISMA_DIR/schema.prisma"
echo "  npx prisma generate"
