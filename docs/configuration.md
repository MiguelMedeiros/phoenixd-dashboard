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

### Other Settings

- **Password Protection** - Secure your dashboard with a password
- **Auto-lock** - Automatically lock after inactivity
- **Lock Screen Background** - Choose from 6 animated backgrounds
- **Push Notifications** - Get notified when you receive payments
- **Tor Proxy** - Route traffic through Tor network
- **Tailscale VPN** - Remote access from anywhere
- **Theme** - Dark, Light, or Auto mode

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
