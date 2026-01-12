#!/bin/bash
# Prepare resources for Tauri build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DESKTOP_DIR")"
RESOURCES_DIR="$DESKTOP_DIR/resources"

echo "Preparing resources for desktop build..."
echo "Project root: $PROJECT_ROOT"
echo "Resources dir: $RESOURCES_DIR"

# Clean and create resources directory
rm -rf "$RESOURCES_DIR"
mkdir -p "$RESOURCES_DIR"

# Detect current platform for phoenixd binary
detect_platform() {
    local os=$(uname -s)
    local arch=$(uname -m)
    
    case "$os" in
        Darwin)
            case "$arch" in
                arm64) echo "phoenixd-aarch64-apple-darwin" ;;
                x86_64) echo "phoenixd-x86_64-apple-darwin" ;;
                *) echo "unknown" ;;
            esac
            ;;
        Linux)
            case "$arch" in
                x86_64) echo "phoenixd-x86_64-unknown-linux-gnu" ;;
                *) echo "unknown" ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "phoenixd-x86_64-pc-windows-msvc.exe"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Copy phoenixd binary
echo ""
echo "=== Copying phoenixd binary ==="
PHOENIXD_BINARY=$(detect_platform)
mkdir -p "$RESOURCES_DIR/binaries"

if [ -f "$DESKTOP_DIR/binaries/$PHOENIXD_BINARY" ]; then
    cp "$DESKTOP_DIR/binaries/$PHOENIXD_BINARY" "$RESOURCES_DIR/binaries/phoenixd"
    chmod +x "$RESOURCES_DIR/binaries/phoenixd"
    echo "Copied: $PHOENIXD_BINARY -> binaries/phoenixd"
else
    echo "Warning: Phoenixd binary not found: $DESKTOP_DIR/binaries/$PHOENIXD_BINARY"
    echo "Run 'scripts/download-phoenixd.sh' first"
fi

# Build and copy backend
echo ""
echo "=== Building backend ==="
cd "$PROJECT_ROOT/backend"

# Use SQLite schema for desktop
if [ -f "prisma/schema.sqlite.prisma" ]; then
    cp "prisma/schema.prisma" "prisma/schema.prisma.bak"
    cp "prisma/schema.sqlite.prisma" "prisma/schema.prisma"
fi

npm run build
npx prisma generate

mkdir -p "$RESOURCES_DIR/backend"
cp -r dist "$RESOURCES_DIR/backend/"
cp -r node_modules "$RESOURCES_DIR/backend/"
cp package.json "$RESOURCES_DIR/backend/"

# Copy prisma files for migrations (using the SQLite schema)
mkdir -p "$RESOURCES_DIR/backend/prisma"
cp prisma/schema.prisma "$RESOURCES_DIR/backend/prisma/"

echo "Backend built and copied"

# Create template database (while SQLite schema is still active)
echo ""
echo "=== Creating template database ==="
DATABASE_URL="file:./template.db" npx prisma db push --accept-data-loss --skip-generate

# Restore original PostgreSQL schema
if [ -f "prisma/schema.prisma.bak" ]; then
    mv "prisma/schema.prisma.bak" "prisma/schema.prisma"
    npx prisma generate
fi
if [ -f "template.db" ]; then
    cp template.db "$RESOURCES_DIR/template.db"
    rm template.db
    echo "Template database created"
elif [ -f "prisma/template.db" ]; then
    cp prisma/template.db "$RESOURCES_DIR/template.db"
    rm prisma/template.db
    echo "Template database created"
fi

# Build and copy frontend (standalone)
echo ""
echo "=== Building frontend (standalone) ==="
cd "$PROJECT_ROOT/frontend"

# Set environment variables for the build (these get baked into the bundle)
export NEXT_PUBLIC_API_URL="http://localhost:4000"
export NEXT_PUBLIC_WS_URL="ws://localhost:4000"

npm run build

# Copy standalone build
mkdir -p "$RESOURCES_DIR/frontend"
if [ -d ".next/standalone" ]; then
    # Copy all standalone files including hidden directories
    cp -R .next/standalone/. "$RESOURCES_DIR/frontend/"
    
    # Ensure .next directory has all required files (BUILD_ID, manifests, etc.)
    if [ -d ".next/standalone/.next" ]; then
        cp -R .next/standalone/.next/. "$RESOURCES_DIR/frontend/.next/"
    fi
    
    # Copy static files (these are not in standalone by default)
    mkdir -p "$RESOURCES_DIR/frontend/.next/static"
    cp -R .next/static/. "$RESOURCES_DIR/frontend/.next/static/"
    
    # Copy public files
    mkdir -p "$RESOURCES_DIR/frontend/public"
    cp -R public/. "$RESOURCES_DIR/frontend/public/"
    
    # Verify BUILD_ID exists
    if [ -f "$RESOURCES_DIR/frontend/.next/BUILD_ID" ]; then
        echo "Frontend built and copied (standalone mode) ✓"
        echo "  BUILD_ID: $(cat "$RESOURCES_DIR/frontend/.next/BUILD_ID")"
    else
        echo "Warning: BUILD_ID not found in frontend bundle"
    fi
else
    echo "Error: Standalone build not found. Make sure next.config.ts has 'output: standalone'"
    exit 1
fi

echo ""
echo "=== Resources prepared successfully! ==="
echo ""
echo "Resources structure:"
find "$RESOURCES_DIR" -maxdepth 3 -type d | head -20
echo ""
echo "Total size:"
du -sh "$RESOURCES_DIR"
