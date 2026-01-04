<p align="center">
  <img src="docs/screenshots/logo.svg" alt="Phoenixd Dashboard" width="120">
</p>

<h1 align="center">Phoenixd Dashboard</h1>

<p align="center">
  <strong>A beautiful, modern dashboard for managing your <a href="https://github.com/ACINQ/phoenixd">phoenixd</a> Lightning node</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bitcoin-Lightning-orange?style=for-the-badge&logo=bitcoin" alt="Bitcoin Lightning">
  <img src="https://img.shields.io/badge/Docker-ready-blue?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Ready">
  <img src="https://img.shields.io/badge/PWA-ready-purple?style=for-the-badge&logo=pwa" alt="PWA Ready">
</p>

---

<p align="center">

https://github.com/user-attachments/assets/SUBSTITUIR_PELA_URL_DO_VIDEO.mp4

</p>

---

## Features

✓ **Receive** · Bolt11 invoices, Bolt12 offers, Lightning Address, QR codes
✓ **Send** · Pay invoices, offers, LN addresses, on-chain transactions
✓ **Dashboard** · Real-time balance, channels, payment activity chart
✓ **History** · Full payment history with filters & CSV export
✓ **Tools** · Decode invoices, estimate liquidity fees, LNURL support
✓ **PWA** · Install as native app — no app store required!
✓ **Remote** · Access from anywhere via Tailscale VPN
✓ **Tor** · Optional hidden service for maximum privacy

---

## Quick Start

```bash
git clone https://github.com/MiguelMedeiros/phoenixd-dashboard
cd phoenixd-dashboard
./scripts/setup.sh
open http://localhost:3000
```

---

## 📚 Documentation

<table>
<tr>
<td width="50%" valign="top">

### 🚀 Getting Started

- **[Installation](docs/installation.md)** - Docker & local setup
- **[Configuration](docs/configuration.md)** - Environment & networks

</td>
<td width="50%" valign="top">

### 📱 Mobile & Remote

- **[PWA Install](docs/pwa-install.md)** - Your phone, no app store
- **[Remote Access](docs/mobile-wallet-setup.md)** - Tailscale VPN setup

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🔐 Security

- **[Backup & Recovery](docs/backup-recovery.md)** - Protect your sats

</td>
<td width="50%" valign="top">

### 🔌 Developers

- **[API Reference](docs/api.md)** - REST & WebSocket

</td>
</tr>
</table>

---

## Screenshots

<details>
<summary><strong>📥 Receive Payments</strong></summary>
<p align="center">
  <img src="docs/screenshots/dashboard-receive.png" alt="Receive" width="800">
</p>
</details>

<details>
<summary><strong>📊 Channel Management</strong></summary>
<p align="center">
  <img src="docs/screenshots/dashboard-channels.png" alt="Channels" width="800">
</p>
</details>

<details>
<summary><strong>📱 Mobile PWA</strong></summary>
<p align="center">
  <img src="docs/screenshots/pwa-mobile-home.png" alt="Mobile" width="300">
  <img src="docs/screenshots/pwa-mobile-receive-qr.png" alt="Receive QR" width="300">
</p>
</details>

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always backup your seed phrase and test with small amounts first.

**Mainnet = Real funds!** ⚡
