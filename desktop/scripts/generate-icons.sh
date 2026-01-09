#!/bin/bash
# Generate Tauri icons from source SVG

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DESKTOP_DIR")"
ICONS_DIR="$DESKTOP_DIR/src-tauri/icons"
SOURCE_ICON="$PROJECT_ROOT/frontend/public/icon.svg"

echo "Generating Tauri icons..."
echo "Source: $SOURCE_ICON"
echo "Target: $ICONS_DIR"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

mkdir -p "$ICONS_DIR"

# Check if we have the tauri CLI
if command -v cargo &> /dev/null; then
    cd "$DESKTOP_DIR"
    
    # Install tauri-cli if not present
    if ! cargo install --list | grep -q "tauri-cli"; then
        echo "Installing tauri-cli..."
        cargo install tauri-cli
    fi
    
    # Generate icons using tauri
    cargo tauri icon "$SOURCE_ICON"
    echo "Icons generated successfully!"
else
    echo "Cargo not found. Please install Rust and Cargo first."
    echo ""
    echo "Alternatively, you can manually create icons in the following sizes:"
    echo "  - 32x32.png"
    echo "  - 128x128.png"
    echo "  - 128x128@2x.png (256x256)"
    echo "  - icon.icns (macOS)"
    echo "  - icon.ico (Windows)"
    echo ""
    echo "You can use tools like ImageMagick, or online converters."
    exit 1
fi
