# /restart-docker - Rebuild and restart Docker containers

Rebuild and restart Docker containers for the phoenixd-dashboard project. Supports targeting specific containers or all containers at once.

## Usage

- `/restart-docker` - Detect changes and rebuild/restart affected containers
- `/restart-docker <container>` - Rebuild and restart a specific container
- `/restart-docker all` - Rebuild and restart all containers

## Available Containers

| Container | Service | Build Context |
| --------- | ------- | ------------- |
| `backend` | phoenixd-backend | ./backend |
| `frontend` | phoenixd-frontend | ./frontend |
| `tor` | phoenixd-tor | ./services/tor |
| `tailscale` | phoenixd-tailscale | ./services/tailscale |
| `phoenixd` | phoenixd | (image only - no rebuild) |
| `postgres` | phoenixd-postgres | (image only - no rebuild) |
| `cloudflared` | phoenixd-cloudflared | (image only - no rebuild) |

## Instructions

### Working Directory

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
```

### Option 1: Auto-detect changes (no parameter)

When no parameter is provided, detect which files have changed and rebuild only affected containers:

1. Check git status for modified files:
   ```bash
   git status --porcelain
   ```

2. Analyze changes:
   - Files in `backend/` → rebuild `backend`
   - Files in `frontend/` → rebuild `frontend`
   - Files in `services/tor/` → rebuild `tor`
   - Files in `services/tailscale/` → rebuild `tailscale`
   - Files in `services/cloudflared/` → restart `cloudflared`
   - `docker-compose.yml` → suggest rebuilding all

3. For each affected container, run the rebuild command (see below)

### Option 2: Specific container

When a container name is provided (e.g., `/restart-docker backend`):

**For containers with build context (backend, frontend, tor, tailscale):**

```bash
docker compose build --no-cache <service>
docker compose up -d <service>
```

**For image-only containers (phoenixd, postgres, cloudflared):**

```bash
docker compose pull <service>
docker compose up -d <service>
```

### Option 3: All containers

When `all` is provided (`/restart-docker all`):

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Post-Restart Checks

After restarting, verify container health:

```bash
docker compose ps
```

Show logs if any container failed to start:

```bash
docker compose logs --tail=20 <failed-service>
```

## Summary Output

Provide a summary table after execution:

| Container | Action | Status |
| --------- | ------ | ------ |
| backend | Rebuilt & Restarted | ✅/❌ |
| frontend | Rebuilt & Restarted | ✅/❌ |
| ... | ... | ... |

## Quick Commands Reference

```bash
# Rebuild and restart backend only
docker compose build --no-cache backend && docker compose up -d backend

# Rebuild and restart frontend only
docker compose build --no-cache frontend && docker compose up -d frontend

# Rebuild and restart all
docker compose down && docker compose build --no-cache && docker compose up -d

# View logs for a specific container
docker compose logs -f backend

# Check container status
docker compose ps
```

## Notes

- Containers with profiles (tor, tailscale, cloudflared) may not be running by default
- Use `docker compose --profile <profile> up -d` to start profiled services
- The `--no-cache` flag ensures a fresh build
- Database migrations run automatically on backend startup
