#!/bin/bash

# Phoenixd Dashboard - Recovery Script
# Restores your phoenixd wallet from a backup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Menu selection function
select_option() {
    local options=("$@")
    local num_options=${#options[@]}
    local selected=0
    local key

    # Hide cursor
    tput civis

    # Print options
    print_menu() {
        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "  ${CYAN}▶${NC} ${BOLD}${options[$i]}${NC}"
            else
                echo -e "    ${options[$i]}"
            fi
        done
    }

    # Initial print
    print_menu

    # Read input
    while true; do
        read -rsn1 key
        
        # Check for escape sequence (arrow keys)
        if [[ $key == $'\x1b' ]]; then
            read -rsn2 key
            case $key in
                '[A') # Up arrow
                    ((selected--))
                    if [ $selected -lt 0 ]; then
                        selected=$((num_options - 1))
                    fi
                    ;;
                '[B') # Down arrow
                    ((selected++))
                    if [ $selected -ge $num_options ]; then
                        selected=0
                    fi
                    ;;
            esac
        elif [[ $key == '' ]]; then # Enter key
            break
        fi

        # Move cursor up and reprint
        tput cuu $num_options
        print_menu
    done

    # Show cursor
    tput cnorm

    return $selected
}

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

# Get list of backups
mapfile -t BACKUPS < <(ls -dt backups/phoenixd-* 2>/dev/null)

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}Error: No valid backups found${NC}"
    exit 1
fi

# Build display options with details
declare -a OPTIONS
for backup in "${BACKUPS[@]}"; do
    backup_name=$(basename "$backup")
    
    # Get network type
    if [ -f "$backup/network.txt" ]; then
        network=$(cat "$backup/network.txt")
    elif [[ $backup_name == *"mainnet"* ]]; then
        network="mainnet"
    elif [[ $backup_name == *"testnet"* ]]; then
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
    [ -f "$backup/seed.dat" ] && files+="seed "
    [ -f "$backup/phoenix.conf" ] && files+="conf "
    ls "$backup"/phoenix.*.db >/dev/null 2>&1 && files+="db "
    
    # Network color
    if [ "$network" = "mainnet" ]; then
        net_display="${GREEN}mainnet${NC}"
    elif [ "$network" = "testnet" ]; then
        net_display="${CYAN}testnet${NC}"
    else
        net_display="${YELLOW}$network${NC}"
    fi
    
    OPTIONS+=("$backup_name  [$network]  $formatted_date  ($files)")
done

# Add cancel option
OPTIONS+=("❌ Cancel")

echo -e "${YELLOW}Select a backup to restore:${NC}"
echo -e "${BLUE}(Use ↑↓ arrow keys to navigate, Enter to select)${NC}"
echo ""

select_option "${OPTIONS[@]}"
selected=$?

# Check if cancelled
if [ $selected -eq $((${#OPTIONS[@]} - 1)) ]; then
    echo ""
    echo -e "${YELLOW}Recovery cancelled.${NC}"
    exit 0
fi

SELECTED_BACKUP="${BACKUPS[$selected]}"
BACKUP_NAME=$(basename "$SELECTED_BACKUP")

echo ""
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
elif [[ $BACKUP_NAME == *"mainnet"* ]]; then
    BACKUP_NETWORK="mainnet"
elif [[ $BACKUP_NAME == *"testnet"* ]]; then
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
