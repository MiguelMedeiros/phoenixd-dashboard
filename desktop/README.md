# Phoenixd Dashboard - Desktop App

Desktop application for Phoenixd Dashboard built with [Tauri](https://tauri.app/).

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Rust](https://rustup.rs/) (for building Tauri)
- Platform-specific dependencies (see below)

### macOS
```bash
xcode-select --install
```

### Windows
- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev
```

## Development Setup

1. **Install dependencies**
   ```bash
   # From project root
   npm run install:all
   npm run desktop:install
   ```

2. **Download phoenixd binaries**
   ```bash
   npm run desktop:download-phoenixd
   ```

3. **Generate icons** (optional, if you want custom icons)
   ```bash
   npm run desktop:icons
   ```

4. **Run in development mode**
   ```bash
   npm run desktop:dev
   ```

## Building for Production

1. **Prepare resources**
   ```bash
   npm run desktop:prepare
   ```

2. **Build the app**
   ```bash
   npm run desktop:build
   ```

The built installers will be in `desktop/src-tauri/target/release/bundle/`.

## Project Structure

```
desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   └── process_manager.rs # Service orchestration
│   ├── icons/                 # App icons
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
├── binaries/                  # Phoenixd binaries (per platform)
├── resources/                 # Bundled resources (generated)
├── scripts/
│   ├── download-phoenixd.sh  # Download phoenixd binaries
│   ├── prepare-resources.sh  # Prepare build resources
│   └── generate-icons.sh     # Generate app icons
└── package.json
```

## How It Works

The desktop app uses Tauri as a lightweight wrapper that:

1. **Starts phoenixd** - The Lightning Network node daemon
2. **Starts the backend** - Node.js API server with SQLite database
3. **Starts the frontend** - Next.js standalone server
4. **Opens a WebView** - Points to `http://localhost:3000`

All services run locally on the user's machine. Data is stored in:
- **macOS**: `~/Library/Application Support/com.phoenixd.dashboard/`
- **Windows**: `%APPDATA%\com.phoenixd.dashboard\`
- **Linux**: `~/.local/share/com.phoenixd.dashboard/`

## Troubleshooting

### Node.js not found
The app looks for Node.js in the system PATH. Make sure Node.js is installed and accessible.

### phoenixd fails to start
Check that the phoenixd binary is in `desktop/binaries/` and is executable.

### Build fails on Linux
Make sure you have all WebKit dependencies installed:
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-0 libappindicator3-dev
```

## License

MIT
