#!/bin/bash

# Phoenixd Dashboard Setup Script
# This script automatically configures the phoenixd password

set -e

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "================================================"
echo "  Phoenixd Dashboard - Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Create data directory with proper permissions
echo -e "${YELLOW}Creating data directory with proper permissions...${NC}"
mkdir -p ./data/phoenixd

# Fix permissions for the phoenixd data directory
# The phoenixd container runs as UID 1000, so we need to ensure the directory is writable
# Using chmod 777 as a safe fallback that works across different host configurations
chmod 777 ./data/phoenixd

echo -e "${GREEN}Data directory ready!${NC}"

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker compose up -d

# Wait for phoenixd to initialize and generate the password
echo -e "${YELLOW}Waiting for phoenixd to initialize (this may take up to 60 seconds)...${NC}"
sleep 10

# Check if phoenixd container is running
if ! docker ps | grep -q phoenixd; then
    echo -e "${RED}Error: phoenixd container is not running.${NC}"
    docker compose logs phoenixd
    exit 1
fi

# Wait for phoenix.conf to be created
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker exec phoenixd test -f /phoenix/.phoenix/phoenix.conf 2>/dev/null; then
        break
    fi
    echo "  Waiting for phoenix.conf... (attempt $((ATTEMPT+1))/$MAX_ATTEMPTS)"
    sleep 2
    ATTEMPT=$((ATTEMPT+1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}Error: phoenix.conf was not created. Check phoenixd logs:${NC}"
    docker compose logs phoenixd
    exit 1
fi

# Extract the password from phoenix.conf
echo -e "${YELLOW}Extracting phoenixd password...${NC}"
PASSWORD=$(docker exec phoenixd cat /phoenix/.phoenix/phoenix.conf | grep "http-password=" | cut -d'=' -f2)

if [ -z "$PASSWORD" ]; then
    echo -e "${RED}Error: Could not extract password from phoenix.conf${NC}"
    exit 1
fi

echo -e "${GREEN}Password found!${NC}"

# Create or update .env file
echo -e "${YELLOW}Updating .env file...${NC}"
if [ -f .env ]; then
    # Remove existing PHOENIXD_PASSWORD line if present
    grep -v "^PHOENIXD_PASSWORD=" .env > .env.tmp 2>/dev/null || true
    mv .env.tmp .env
fi

echo "PHOENIXD_PASSWORD=$PASSWORD" >> .env

echo -e "${GREEN}.env file updated!${NC}"

# Recreate backend to apply new password (restart doesn't reload .env variables)
echo -e "${YELLOW}Recreating backend with new password...${NC}"
docker compose up -d backend --force-recreate

# Wait for backend to be healthy
echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
sleep 10

# Check if all services are running
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Dashboard URL: http://localhost:3000"
echo ""
echo "Services status:"
docker compose ps
echo ""
echo -e "${YELLOW}Note: The phoenixd password has been saved to .env${NC}"
echo -e "${YELLOW}Do not commit this file to version control!${NC}"
echo ""
