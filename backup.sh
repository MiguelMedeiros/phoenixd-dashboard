#!/bin/bash

# Phoenixd Dashboard - Backup Script
# Creates a backup of your phoenixd wallet data

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "================================================"
echo "   Phoenixd Dashboard - Backup Script"
echo "================================================"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^phoenixd$"; then
    echo -e "${RED}Error: phoenixd container is not running.${NC}"
    echo "Start it with: docker compose up -d"
    exit 1
fi

# Create backup directory
BACKUP_DIR="backups/phoenixd-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Creating backup in: $BACKUP_DIR${NC}"
echo ""

# Backup seed (CRITICAL)
echo "📦 Backing up seed.dat..."
if docker exec phoenixd cat /phoenix/.phoenix/seed.dat > "$BACKUP_DIR/seed.dat" 2>/dev/null; then
    echo -e "   ${GREEN}✓ seed.dat${NC}"
else
    echo -e "   ${RED}✗ seed.dat not found${NC}"
fi

# Backup phoenix.conf
echo "📦 Backing up phoenix.conf..."
if docker exec phoenixd cat /phoenix/.phoenix/phoenix.conf > "$BACKUP_DIR/phoenix.conf" 2>/dev/null; then
    echo -e "   ${GREEN}✓ phoenix.conf${NC}"
else
    echo -e "   ${RED}✗ phoenix.conf not found${NC}"
fi

# Backup channels.db
echo "📦 Backing up channels.db..."
if docker cp phoenixd:/phoenix/.phoenix/channels.db "$BACKUP_DIR/channels.db" 2>/dev/null; then
    echo -e "   ${GREEN}✓ channels.db${NC}"
else
    echo -e "   ${YELLOW}⚠ channels.db not found (no channels opened yet)${NC}"
fi

# Show seed phrase
echo ""
echo "================================================"
echo -e "${GREEN}   Backup Complete!${NC}"
echo "================================================"
echo ""
echo -e "Backup location: ${GREEN}$BACKUP_DIR${NC}"
echo ""

# Display seed phrase
if [ -f "$BACKUP_DIR/seed.dat" ]; then
    echo "================================================"
    echo -e "${YELLOW}   YOUR SEED PHRASE (KEEP THIS SAFE!)${NC}"
    echo "================================================"
    echo ""
    cat "$BACKUP_DIR/seed.dat"
    echo ""
    echo ""
    echo -e "${RED}⚠️  WARNING: Anyone with this seed can steal your funds!${NC}"
    echo -e "${RED}   Store it in a secure, offline location.${NC}"
    echo ""
fi

# Security reminder
echo "================================================"
echo "   Security Tips"
echo "================================================"
echo ""
echo "1. Store your seed phrase in a secure, offline location"
echo "2. Consider using a password manager or hardware backup"
echo "3. Never share your seed phrase with anyone"
echo "4. Test recovery with a small amount first"
echo ""
