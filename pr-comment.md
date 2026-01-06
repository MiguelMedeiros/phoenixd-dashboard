# Fix: "Failed to Fetch" Error (Issue #3)

## The Problem

The frontend uses `localhost:4001` as the default API URL. When you access from another machine, the browser tries to connect to `localhost` **on your PC**, not the Docker server.

```
Your PC → fetch("localhost:4001") → Nothing running here!
```

## The Solution

The frontend now **automatically detects** the correct URL based on how you access:

- `localhost` → `http://localhost:4001`
- `192.168.1.100` → `http://192.168.1.100:4001`
- `*.ts.net` → `https://hostname.ts.net:4001`

## How to Update

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Workaround (older versions)

Create a `.env` file with:

```bash
NEXT_PUBLIC_API_URL=http://YOUR_IP:4001
NEXT_PUBLIC_WS_URL=ws://YOUR_IP:4001
```

Then rebuild: `docker compose build frontend --no-cache && docker compose up -d`

## Files Changed

- `frontend/src/lib/api.ts` - automatic URL detection
- `frontend/src/hooks/use-websocket.ts` - automatic WebSocket URL detection
- `docs/installation.md` - troubleshooting section added
- `.env.example` - new file with documented environment variables

## Tests: 487 passing (156 backend + 178 frontend + 153 E2E)
