# Installation Guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Node.js 20+ (for local development only)

---

## Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/MiguelMedeiros/phoenixd-dashboard
cd phoenixd-dashboard

# Run the setup script (recommended for first time)
./scripts/setup.sh

# Open the dashboard
open http://localhost:3000
```

The setup script will:

- Create the data directory with proper permissions
- Start all Docker services
- Wait for phoenixd to initialize
- Automatically sync the generated password
- Restart the backend with the correct configuration

---

## Manual Start

If you've already run setup once:

```bash
docker compose up -d
```

---

## Troubleshooting Permission Issues

If you encounter a permission error like:

```
Failed to open /phoenix/.phoenix/phoenix.conf with Permission denied
```

Run the following commands:

```bash
# Stop the containers
docker compose down

# Fix permissions (recommended - secure)
sudo chown 1000:1000 ./data/phoenixd
chmod 700 ./data/phoenixd

# Run setup again
./scripts/setup.sh
```

**Alternative solutions:**

```bash
# If you can't use sudo, use group-writable permissions
chmod 770 ./data/phoenixd

# Or remove the data directory and start fresh
rm -rf ./data/phoenixd
./scripts/setup.sh
```

> ⚠️ **Security Note**: Avoid using `chmod 777` as it allows any user on the system to read/write sensitive wallet data including your seed phrase.

---

## Local Development

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```mermaid
graph LR
    subgraph Docker Compose
        A[Frontend<br/>Next.js<br/>:3000] --> B[Backend<br/>Express<br/>:4001]
        B --> C[Phoenixd<br/>Lightning<br/>:9740]
        B --> D[(PostgreSQL<br/>:5433)]
    end

    User((User)) --> A
```

| Service        | Description                       | Port |
| -------------- | --------------------------------- | ---- |
| **Frontend**   | Next.js 15 + React 19 + shadcn/ui | 3000 |
| **Backend**    | Express + TypeScript + Prisma     | 4001 |
| **Phoenixd**   | ACINQ Lightning Node              | 9740 |
| **PostgreSQL** | Payment history cache             | 5433 |
| **Tailscale**  | VPN for remote access (optional)  | -    |
| **Tor**        | Hidden service (optional)         | -    |

---

## Next Steps

- [Configuration](configuration.md) - Environment variables and network settings
- [PWA Install](pwa-install.md) - Install as mobile app
- [Remote Access](mobile-wallet-setup.md) - Access from anywhere with Tailscale
