<p align="center">
  <img src="docs/screenshots/logo.svg" alt="Phoenixd Dashboard" width="120">
</p>

<h1 align="center">Phoenixd Dashboard</h1>

<p align="center">
  <strong>A modern, self-hosted dashboard for your <a href="https://github.com/ACINQ/phoenixd">phoenixd</a> Lightning node</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Docs</a> •
  <a href="#screenshots">Screenshots</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bitcoin-Lightning-F7931A?style=flat-square&logo=bitcoin&logoColor=white" alt="Bitcoin Lightning">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Ready">
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA Ready">
  <img src="https://img.shields.io/github/license/MiguelMedeiros/phoenixd-dashboard?style=flat-square" alt="License">
</p>

<br>

<p align="center">

https://github.com/user-attachments/assets/494d58b8-1e23-473e-8aca-74a2705ac33e

</p>

<br>

## Features

✅ **Send & Receive** — Bolt11, Bolt12 offers, Lightning Address, On-chain

✅ **Dashboard** — Real-time balance, channel stats, payment activity

✅ **History** — Full payment history with filters & CSV export

✅ **Tools** — Decode invoices, liquidity fees, LNURL support

✅ **Multi-Currency** — Display in 10+ fiat currencies

✅ **PWA** — Install as native app on any device

✅ **Remote Access** — Tailscale VPN, Cloudflare Tunnel, or Tor Hidden Service

<br>

## Quick Start

```bash
# Clone the repository
git clone https://github.com/MiguelMedeiros/phoenixd-dashboard
cd phoenixd-dashboard

# Run the setup script
./scripts/setup.sh

# Open in your browser
open http://localhost:3000
```

> **Note:** Requires Docker and Docker Compose. See [Installation](docs/installation.md) for detailed instructions.

<br>

## Documentation

### Getting Started

- 📦 [**Installation**](docs/installation.md) — Docker setup, local development, and requirements
- ⚙️ [**Configuration**](docs/configuration.md) — Environment variables, network modes, and options

### Mobile & Remote Access

- 📱 [**PWA Installation**](docs/pwa-install.md) — Install on iOS/Android without app stores
- 🔗 [**Tailscale VPN**](docs/mobile-wallet-setup.md) — Private remote access via Tailscale
- ☁️ [**Cloudflare Tunnel**](docs/cloudflare-tunnel.md) — Public access with custom domain
- 🧅 [**Tor Hidden Service**](docs/tor-hidden-service.md) — Anonymous access via .onion address

### Security & API

- 💾 [**Backup & Recovery**](docs/backup-recovery.md) — Protect your funds with proper backups
- 🔌 [**API Reference**](docs/api.md) — REST endpoints and WebSocket events

<br>

## Screenshots

<details>
<summary><strong>Desktop Dashboard</strong></summary>
<br>
<p align="center">
  <img src="docs/screenshots/dashboard-overview-desktop.png" alt="Dashboard Overview" width="800">
</p>
</details>

<details>
<summary><strong>Receive Payments</strong></summary>
<br>
<p align="center">
  <img src="docs/screenshots/dashboard-receive.png" alt="Receive Payments" width="800">
</p>
</details>

<details>
<summary><strong>Channel Management</strong></summary>
<br>
<p align="center">
  <img src="docs/screenshots/dashboard-channels.png" alt="Channel Management" width="800">
</p>
</details>

<details>
<summary><strong>Mobile PWA</strong></summary>
<br>
<p align="center">
  <img src="docs/screenshots/pwa-mobile-home.png" alt="Mobile Home" width="280">
  &nbsp;&nbsp;
  <img src="docs/screenshots/pwa-mobile-receive-qr.png" alt="Mobile Receive" width="280">
</p>
</details>

<br>

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

<br>

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<br>

---

<p align="center">
  <strong>⚠️ Disclaimer</strong><br>
  <sub>This software is provided "as is" without warranty. Use at your own risk.<br>
  Always backup your seed phrase and test with small amounts first.<br>
  <strong>Mainnet = Real funds!</strong> ⚡</sub>
</p>
