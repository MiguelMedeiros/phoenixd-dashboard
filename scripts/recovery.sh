#!/bin/bash

# Phoenixd Dashboard - Recovery Script
# Restores your phoenixd wallet from a backup

set -e

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo "================================================"
echo "   Phoenixd Dashboard - Recovery Script"
echo "================================================"
echo ""

# Check if backups directory exists
if [ ! -d "backups" ] || [ -z "$(ls -A backups 2>/dev/null)" ]; then
    echo -e "${RED}Error: No backups found in ./backups directory${NC}"
    exit 1
fi

# Get list of backups into an array (compatible with bash and zsh)
BACKUPS=()
while IFS= read -r line; do
    BACKUPS+=("$line")
done < <(ls -dt backups/phoenixd-* 2>/dev/null)

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}Error: No valid backups found${NC}"
    exit 1
fi

# Build display list
echo -e "${YELLOW}Available backups:${NC}"
echo ""

index=0
for backup in "${BACKUPS[@]}"; do
    backup_name=$(basename "$backup")
    
    # Get network type
    if [ -f "$backup/network.txt" ]; then
        network=$(cat "$backup/network.txt")
    elif echo "$backup_name" | grep -q "mainnet"; then
        network="mainnet"
    elif echo "$backup_name" | grep -q "testnet"; then
        network="testnet"
    else
        network="unknown"
    fi
    
    # Get backup date from name
    date_part=$(echo "$backup_name" | grep -oE '[0-9]{8}-[0-9]{6}' | head -1)
    if [ -n "$date_part" ]; then
        formatted_date=$(echo "$date_part" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)-\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
    else
        formatted_date="unknown date"
    fi
    
    # Check what files exist
    files=""
    [ -f "$backup/seed.dat" ] && files="${files}seed "
    [ -f "$backup/phoenix.conf" ] && files="${files}conf "
    ls "$backup"/phoenix.*.db >/dev/null 2>&1 && files="${files}db "
    
    # Network color indicator
    if [ "$network" = "mainnet" ]; then
        net_color="${GREEN}"
    elif [ "$network" = "testnet" ]; then
        net_color="${CYAN}"
    else
        net_color="${YELLOW}"
    fi
    
    echo -e "  ${BOLD}[$index]${NC} $backup_name"
    echo -e "      Network: ${net_color}$network${NC} | Date: $formatted_date | Files: $files"
    echo ""
    
    index=$((index + 1))
done

echo -e "  ${BOLD}[c]${NC} Cancel"
echo ""

# Get user selection
echo -e "${YELLOW}Enter backup number to restore (or 'c' to cancel):${NC} "
read -r selection

# Check if cancelled
if [ "$selection" = "c" ] || [ "$selection" = "C" ]; then
    echo ""
    echo -e "${YELLOW}Recovery cancelled.${NC}"
    exit 0
fi

# Validate selection
if ! echo "$selection" | grep -qE '^[0-9]+$'; then
    echo -e "${RED}Invalid selection${NC}"
    exit 1
fi

if [ "$selection" -ge "${#BACKUPS[@]}" ] || [ "$selection" -lt 0 ]; then
    echo -e "${RED}Invalid selection: backup $selection does not exist${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$selection]}"
BACKUP_NAME=$(basename "$SELECTED_BACKUP")

echo ""
echo -e "${YELLOW}Selected: ${GREEN}$BACKUP_NAME${NC}"
echo ""

# Show backup contents
echo "================================================"
echo "   Backup Contents"
echo "================================================"
echo ""
ls -la "$SELECTED_BACKUP"
echo ""

# Show seed if exists
if [ -f "$SELECTED_BACKUP/seed.dat" ]; then
    echo "================================================"
    echo -e "${YELLOW}   Seed Phrase in Backup${NC}"
    echo "================================================"
    echo ""
    cat "$SELECTED_BACKUP/seed.dat"
    echo ""
    echo ""
fi

# Get network from backup
if [ -f "$SELECTED_BACKUP/network.txt" ]; then
    BACKUP_NETWORK=$(cat "$SELECTED_BACKUP/network.txt")
elif echo "$BACKUP_NAME" | grep -q "mainnet"; then
    BACKUP_NETWORK="mainnet"
elif echo "$BACKUP_NAME" | grep -q "testnet"; then
    BACKUP_NETWORK="testnet"
else
    BACKUP_NETWORK="unknown"
fi

echo -e "Backup network: ${CYAN}$BACKUP_NETWORK${NC}"
echo ""

# Warning
echo "================================================"
echo -e "${RED}   ⚠️  WARNING${NC}"
echo "================================================"
echo ""
echo -e "${RED}This will REPLACE your current phoenixd data!${NC}"
echo ""
echo "The following will be overwritten:"
echo "  - seed.dat (your wallet seed)"
echo "  - phoenix.conf (configuration)"
echo "  - Database files"
echo ""
echo -e "${YELLOW}Make sure you have a backup of your current data before proceeding!${NC}"
echo ""

# Confirmation
echo -e "${BOLD}Are you sure you want to restore this backup?${NC}"
echo ""
echo -e "${YELLOW}Type 'yes' to confirm:${NC} "
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo -e "${YELLOW}Recovery cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Stopping phoenixd container...${NC}"

# Stop the container
if docker ps --format '{{.Names}}' | grep -q "^phoenixd$"; then
    docker stop phoenixd
    echo -e "${GREEN}✓ Container stopped${NC}"
else
    echo -e "${YELLOW}Container was not running${NC}"
fi

# Restore files
echo ""
echo -e "${YELLOW}Restoring backup files...${NC}"

DATA_DIR="./data/phoenixd"

# Restore seed.dat
if [ -f "$SELECTED_BACKUP/seed.dat" ]; then
    cp "$SELECTED_BACKUP/seed.dat" "$DATA_DIR/seed.dat"
    echo -e "${GREEN}✓ seed.dat restored${NC}"
fi

# Restore phoenix.conf
if [ -f "$SELECTED_BACKUP/phoenix.conf" ]; then
    cp "$SELECTED_BACKUP/phoenix.conf" "$DATA_DIR/phoenix.conf"
    echo -e "${GREEN}✓ phoenix.conf restored${NC}"
fi

# Restore database files
for db_file in "$SELECTED_BACKUP"/phoenix.*.db*; do
    if [ -f "$db_file" ]; then
        filename=$(basename "$db_file")
        cp "$db_file" "$DATA_DIR/$filename"
        echo -e "${GREEN}✓ $filename restored${NC}"
    fi
done

# Update .env if network changed
if [ "$BACKUP_NETWORK" = "testnet" ]; then
    if grep -q "^PHOENIXD_CHAIN=" .env 2>/dev/null; then
        sed -i.bak 's/^PHOENIXD_CHAIN=.*/PHOENIXD_CHAIN=testnet/' .env
    else
        echo "PHOENIXD_CHAIN=testnet" >> .env
    fi
    echo -e "${GREEN}✓ .env updated for testnet${NC}"
elif [ "$BACKUP_NETWORK" = "mainnet" ]; then
    if grep -q "^PHOENIXD_CHAIN=" .env 2>/dev/null; then
        sed -i.bak 's/^PHOENIXD_CHAIN=.*/#PHOENIXD_CHAIN=/' .env
    fi
    echo -e "${GREEN}✓ .env updated for mainnet${NC}"
fi

# Restart containers
echo ""
echo -e "${YELLOW}Restarting containers...${NC}"
docker compose up -d

# Wait for services
echo ""
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Check status
echo ""
echo "================================================"
echo -e "${GREEN}   Recovery Complete!${NC}"
echo "================================================"
echo ""
echo "Services status:"
docker compose ps
echo ""
echo -e "${GREEN}Your wallet has been restored from: $BACKUP_NAME${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to wait a few minutes for the node to sync.${NC}"
echo ""
