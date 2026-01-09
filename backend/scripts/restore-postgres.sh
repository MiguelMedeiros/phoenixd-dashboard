#!/bin/bash
# Restore backend to PostgreSQL mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PRISMA_DIR="$BACKEND_DIR/prisma"

echo "Restoring backend to PostgreSQL mode..."

if [ -f "$PRISMA_DIR/schema.prisma.bak" ]; then
  cp "$PRISMA_DIR/schema.prisma.bak" "$PRISMA_DIR/schema.prisma"
  rm "$PRISMA_DIR/schema.prisma.bak"
  
  cd "$BACKEND_DIR"
  npx prisma generate
  
  echo "PostgreSQL schema restored!"
else
  echo "No backup found. Schema is likely already PostgreSQL."
fi
