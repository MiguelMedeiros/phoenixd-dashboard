#!/bin/bash
# Download phoenixd binaries for all platforms

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
BINARIES_DIR="$DESKTOP_DIR/binaries"

# Phoenixd release version - update this to get newer versions
PHOENIXD_VERSION="${PHOENIXD_VERSION:-0.3.4}"
PHOENIXD_REPO="ACINQ/phoenixd"

echo "Downloading phoenixd v${PHOENIXD_VERSION} binaries..."
echo "Target directory: $BINARIES_DIR"

mkdir -p "$BINARIES_DIR"

# Function to download and extract phoenixd
download_phoenixd() {
    local platform=$1
    local archive_name=$2
    local binary_name=$3
    local extract_path=$4
    
    echo ""
    echo "Downloading phoenixd for $platform..."
    
    local url="https://github.com/${PHOENIXD_REPO}/releases/download/v${PHOENIXD_VERSION}/${archive_name}"
    local temp_dir=$(mktemp -d)
    
    echo "URL: $url"
    
    # Download
    if command -v curl &> /dev/null; then
        curl -L -o "$temp_dir/$archive_name" "$url" || {
            echo "Failed to download $platform binary"
            rm -rf "$temp_dir"
            return 1
        }
    elif command -v wget &> /dev/null; then
        wget -O "$temp_dir/$archive_name" "$url" || {
            echo "Failed to download $platform binary"
            rm -rf "$temp_dir"
            return 1
        }
    else
        echo "Error: curl or wget is required"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Extract
    cd "$temp_dir"
    if [[ "$archive_name" == *.zip ]]; then
        unzip -q "$archive_name"
    else
        tar -xzf "$archive_name"
    fi
    
    # Find and copy binary
    local found_binary=$(find . -name "phoenixd*" -type f ! -name "*.zip" ! -name "*.tar.gz" | head -1)
    if [ -n "$found_binary" ]; then
        cp "$found_binary" "$BINARIES_DIR/$binary_name"
        chmod +x "$BINARIES_DIR/$binary_name"
        echo "Saved: $BINARIES_DIR/$binary_name"
    else
        echo "Warning: Binary not found in archive for $platform"
    fi
    
    # Cleanup
    cd "$SCRIPT_DIR"
    rm -rf "$temp_dir"
}

# macOS ARM64 (Apple Silicon)
download_phoenixd \
    "macOS-arm64" \
    "phoenix-${PHOENIXD_VERSION}-macos-arm64.zip" \
    "phoenixd-aarch64-apple-darwin" \
    "phoenix-${PHOENIXD_VERSION}-macos-arm64"

# macOS x86_64 (Intel)
download_phoenixd \
    "macOS-x64" \
    "phoenix-${PHOENIXD_VERSION}-macos-x64.zip" \
    "phoenixd-x86_64-apple-darwin" \
    "phoenix-${PHOENIXD_VERSION}-macos-x64"

# Linux x86_64
download_phoenixd \
    "Linux-x64" \
    "phoenix-${PHOENIXD_VERSION}-linux-x64.zip" \
    "phoenixd-x86_64-unknown-linux-gnu" \
    "phoenix-${PHOENIXD_VERSION}-linux-x64"

# Windows x86_64
download_phoenixd \
    "Windows-x64" \
    "phoenix-${PHOENIXD_VERSION}-windows-x64.zip" \
    "phoenixd-x86_64-pc-windows-msvc.exe" \
    "phoenix-${PHOENIXD_VERSION}-windows-x64"

echo ""
echo "Download complete!"
echo ""
echo "Downloaded binaries:"
ls -la "$BINARIES_DIR"
