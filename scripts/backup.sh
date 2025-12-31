#!/bin/bash

# Phoenixd Dashboard - Backup Script
# Creates a backup of your phoenixd wallet data

set -e

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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

# Detect which network is running
echo -e "${YELLOW}Detecting network...${NC}"
NETWORK=$(docker logs phoenixd 2>&1 | grep "chain:" | tail -1 | awk '{print $4}')

if [ "$NETWORK" = "Testnet3" ]; then
    NETWORK_NAME="testnet"
    echo -e "Network: ${CYAN}Testnet${NC}"
else
    NETWORK_NAME="mainnet"
    echo -e "Network: ${GREEN}Mainnet${NC}"
fi
echo ""

# Create backup directory with network name
BACKUP_DIR="backups/phoenixd-${NETWORK_NAME}-$(date +%Y%m%d-%H%M%S)"
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

# Backup database for the current network
echo "📦 Backing up database..."
DB_PATTERN="phoenix.${NETWORK_NAME}.*.db"
DB_FILE=$(docker exec phoenixd ls /phoenix/.phoenix/ 2>/dev/null | grep -E "^phoenix\.${NETWORK_NAME}\.[a-f0-9]+\.db$" | head -1)

if [ -n "$DB_FILE" ]; then
    if docker cp "phoenixd:/phoenix/.phoenix/$DB_FILE" "$BACKUP_DIR/$DB_FILE" 2>/dev/null; then
        echo -e "   ${GREEN}✓ $DB_FILE${NC}"
        
        # Also backup WAL and SHM files if they exist
        docker cp "phoenixd:/phoenix/.phoenix/${DB_FILE}-wal" "$BACKUP_DIR/${DB_FILE}-wal" 2>/dev/null && \
            echo -e "   ${GREEN}✓ ${DB_FILE}-wal${NC}" || true
        docker cp "phoenixd:/phoenix/.phoenix/${DB_FILE}-shm" "$BACKUP_DIR/${DB_FILE}-shm" 2>/dev/null && \
            echo -e "   ${GREEN}✓ ${DB_FILE}-shm${NC}" || true
    else
        echo -e "   ${RED}✗ Failed to backup database${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠ No database found for ${NETWORK_NAME}${NC}"
fi

# Save network info
echo "$NETWORK_NAME" > "$BACKUP_DIR/network.txt"

# Show backup complete
echo ""
echo "================================================"
echo -e "${GREEN}   Backup Complete!${NC}"
echo "================================================"
echo ""
echo -e "Network:         ${CYAN}$NETWORK_NAME${NC}"
echo -e "Backup location: ${GREEN}$BACKUP_DIR${NC}"
echo ""

# List backup contents
echo "Backup contents:"
ls -la "$BACKUP_DIR"
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
    echo -e "${CYAN}ℹ️  Note: The same seed is used for both mainnet and testnet.${NC}"
    echo -e "${CYAN}   Different keys are derived for each network.${NC}"
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
