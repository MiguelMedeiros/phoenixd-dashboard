# Configuration

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable            | Description                                       | Default              |
| ------------------- | ------------------------------------------------- | -------------------- |
| `PHOENIXD_CHAIN`    | Network: empty for mainnet, `testnet` for testnet | _(empty = mainnet)_  |
| `PHOENIXD_PASSWORD` | API password from phoenix.conf                    | _(auto-read)_        |
| `POSTGRES_USER`     | PostgreSQL username                               | `phoenixd`           |
| `POSTGRES_PASSWORD` | PostgreSQL password                               | `phoenixd_secret`    |
| `POSTGRES_DB`       | PostgreSQL database name                          | `phoenixd_dashboard` |
| `TS_AUTHKEY`        | Tailscale auth key (managed via Settings UI)      | _(set in dashboard)_ |
| `TS_HOSTNAME`       | Tailscale machine hostname for Magic DNS          | `phoenixd-dashboard` |

---

## Switching Between Mainnet and Testnet

The dashboard runs phoenixd on **mainnet** by default.

### Using Testnet

```bash
# In your .env file, add:
PHOENIXD_CHAIN=testnet
```

Then restart:

```bash
docker compose down
docker compose up -d
```

### Using Mainnet (default)

```bash
# In your .env file, comment out or remove:
# PHOENIXD_CHAIN=testnet
```

Then restart:

```bash
docker compose down
docker compose up -d
```

> 💡 **Tip:** When switching networks, phoenixd creates a separate database for each network. Your mainnet data remains safe when running on testnet.

---

## ⚠️ Network Warning

> **Mainnet = Real funds!** Always backup your seed phrase and test with small amounts first.
>
> Use testnet for development and testing. Get testnet coins from a [Bitcoin Testnet Faucet](https://coinfaucet.eu/en/btc-testnet/).

---

## Dashboard Settings

The Settings page provides access to various dashboard preferences:

### Display Currency

Choose how monetary values are displayed throughout the dashboard:

- **BTC (sats)** - Default, shows values in satoshis
- **Fiat currencies** - Real-time conversion using CoinGecko API

**Supported currencies:** USD, EUR, BRL, CAD, GBP, JPY, AUD, CHF, MXN

The preference is saved locally and prices are cached for 60 seconds to avoid rate limiting.

### Bitcoin Unit Display (BIP-177)

Choose how Bitcoin amounts are displayed:

- **Classic (sats)** - Traditional satoshi display (e.g., "100,000 sats")
- **Modern (BIP-177)** - Uses ₿ symbol (e.g., "₿100,000")

BIP-177 proposes using ₿ (lowercase bitcoin) as the base unit symbol instead of 'sats'. Both formats represent the same value.

### Celebration Animations

When you receive a payment, the dashboard can show a celebration animation:

- **Confetti** - Colorful confetti explosion
- **Thunder** - Lightning bolt effects
- **Fireworks** - Fireworks display
- **Electric Spark** - Electric spark animation
- **Coin Rain** - Bitcoin coins falling
- **None** - Disable animations

You can also enable/disable sound effects for animations.

### Other Settings

- **Password Protection** - Secure your dashboard with a password
- **Auto-lock** - Automatically lock after inactivity
- **Lock Screen Background** - Choose from 6 animated backgrounds
- **Push Notifications** - Get notified when you receive payments
- **Theme** - Dark, Light, or Auto mode

---

## Multi-Node Connections

The dashboard supports connecting to multiple phoenixd instances, allowing you to easily switch between different nodes.

### Docker (Local) Connection

By default, the dashboard connects to the phoenixd instance running in Docker. This connection is always available and cannot be deleted.

### External Phoenixd Connections

You can add connections to phoenixd instances running outside of Docker:

1. Go to **Settings → Network**
2. Click **Add Connection**
3. Enter a name, URL (e.g., `http://192.168.1.100:9740`), and API password
4. Click **Test Connection** to verify
5. Save the connection

> 📖 **Need help finding your password and URL?** See the complete [External Phoenixd Guide](external-phoenixd.md) for step-by-step instructions.

### Switching Between Nodes

- Click **Activate** on any connection to switch to it
- The active connection is highlighted with a green indicator
- Recurring payments are tied to the connection they were created on

> 💡 **Tip:** Use this feature to manage mainnet and testnet nodes, or to connect to a remote phoenixd server.

---

## Remote Access Options

The dashboard supports three methods for secure remote access. Configure them in **Settings → Network**.

### Tailscale VPN

Private access via Tailscale's zero-config VPN:
- **Best for**: Personal/family use, fast private access
- **Requires**: Tailscale account and app on devices
- **Setup**: Enter auth key in Settings, enable
- 📖 [Full Tailscale Guide](mobile-wallet-setup.md)

### Cloudflare Tunnel

Public access with custom domain:
- **Best for**: Custom domains, public-facing dashboards
- **Requires**: Cloudflare account and domain
- **Features**: Free HTTPS, DDoS protection, global edge
- 📖 [Full Cloudflare Guide](cloudflare-tunnel.md)

### Tor Hidden Service

Anonymous access via .onion address:
- **Best for**: Maximum privacy, no accounts needed
- **Requires**: Tor Browser on accessing device
- **Trade-off**: Slower but completely anonymous
- 📖 [Full Tor Guide](tor-hidden-service.md)

| Feature | Tailscale | Cloudflare | Tor |
|---------|-----------|------------|-----|
| Speed | ✅ Fast | ✅ Fast | ⚠️ Slow |
| Privacy | ⚠️ Medium | ⚠️ Medium | ✅ High |
| Custom domain | ❌ | ✅ | ❌ |
| Account required | ✅ | ✅ | ❌ |
| Public access | ❌ | ✅ | ⚠️ Tor only |

> 💡 **Tip:** You can enable multiple methods simultaneously for different use cases.

---

## Forgot Dashboard Password?

Reset the password using the provided script:

```bash
./scripts/reset-password.sh
```

This removes password protection. Set a new password in the Settings page.

**Manual Reset (Alternative):**

```bash
docker exec phoenixd-postgres psql -U phoenixd -d phoenixd_dashboard -c \
  "UPDATE \"Settings\" SET \"passwordHash\" = NULL WHERE id = 'singleton';"
```

> **Note:** This only removes the dashboard password. It does NOT affect your node, funds, or seed phrase.
