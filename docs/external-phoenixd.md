# Connecting to External Phoenixd

This guide explains how to connect the Phoenixd Dashboard to a phoenixd instance running outside of Docker (e.g., on a VPS, Raspberry Pi, or another machine).

## Overview

By default, the dashboard connects to its bundled Docker-based phoenixd. However, you can also connect to:

- A phoenixd running natively on the same machine
- A phoenixd running on another server in your network
- A remote phoenixd accessible over the internet

## Prerequisites

1. A running phoenixd instance (v0.4.0 or later recommended)
2. Network access between the dashboard and phoenixd
3. The API password from your phoenixd configuration

---

## Step 1: Find Your Phoenixd Configuration

The phoenixd configuration file contains your API password. Its location depends on your operating system:

### Linux / Raspberry Pi

```bash
~/.phoenix/phoenix.conf
```

### macOS

```bash
~/Library/Application Support/Phoenix/phoenix.conf
```

### Windows

```bash
C:\Users\<YourUsername>\AppData\Roaming\Phoenix\phoenix.conf
```

### View the Configuration

```bash
# Linux/macOS
cat ~/.phoenix/phoenix.conf

# Or for macOS
cat ~/Library/Application\ Support/Phoenix/phoenix.conf
```

Example output:

```
http-bind-ip=127.0.0.1
http-bind-port=9740
http-password=your-secret-password-here
```

---

## Step 2: Get Your API Password

The API password is the value of `http-password` in your `phoenix.conf` file:

```bash
# Extract just the password (Linux/macOS)
grep http-password ~/.phoenix/phoenix.conf
```

**Output:**
```
http-password=abc123xyz789
```

Copy the value after the `=` sign. This is your API password.

---

## Step 3: Enable External Access (If Needed)

By default, phoenixd only listens on `127.0.0.1` (localhost), which means it only accepts connections from the same machine.

### For Local Network Access

To allow connections from other devices on your network, edit `phoenix.conf`:

```bash
nano ~/.phoenix/phoenix.conf
```

Change:
```
http-bind-ip=127.0.0.1
```

To:
```
http-bind-ip=0.0.0.0
```

Then restart phoenixd:

```bash
# If running as a service
sudo systemctl restart phoenixd

# Or if running manually, stop and start it again
```

### Security Considerations

> ⚠️ **Warning:** Opening phoenixd to `0.0.0.0` exposes it to your entire network. Make sure your network is secure, or use a firewall to restrict access.

For remote access over the internet, consider:
- Using a VPN (Tailscale, WireGuard)
- Setting up a reverse proxy with HTTPS
- Using SSH tunneling

---

## Step 4: Determine Your Connection URL

The URL format is:

```
http://<ip-address>:<port>
```

### Examples

| Scenario | URL |
|----------|-----|
| Same machine | `http://127.0.0.1:9740` |
| Local network (by IP) | `http://192.168.1.100:9740` |
| Local network (by hostname) | `http://my-server.local:9740` |
| Tailscale | `http://my-node.tailnet-name.ts.net:9740` |

### Find Your IP Address

```bash
# Linux
ip addr show | grep "inet "

# macOS
ifconfig | grep "inet "

# Or simply
hostname -I    # Linux
```

---

## Step 5: Add the Connection in Dashboard

1. Open your Phoenixd Dashboard
2. Go to **Settings** → **Network** section
3. Scroll to **Node Connections**
4. Click **Add Connection**

Fill in the form:

| Field | Value | Example |
|-------|-------|---------|
| **Connection Name** | A friendly name | `My VPS Node` |
| **Phoenixd URL** | The URL from Step 4 | `http://192.168.1.100:9740` |
| **API Password** | Password from Step 2 | `abc123xyz789` |

5. Click **Test Connection** to verify it works
6. If successful, click **Save**

---

## Step 6: Activate the Connection

After saving:

1. You'll see the new connection in the list
2. Click **Activate** to switch to it
3. The dashboard will now use this external phoenixd

The active connection shows a green indicator.

---

## Troubleshooting

### "Connection refused" Error

**Cause:** Phoenixd is not accepting connections on that address.

**Solutions:**
1. Verify phoenixd is running: `ps aux | grep phoenixd`
2. Check `http-bind-ip` is set to `0.0.0.0` (for remote access)
3. Verify the port is correct (default: 9740)
4. Check firewall rules: `sudo ufw status` or `sudo iptables -L`

### "Invalid authentication" Error

**Cause:** Wrong API password.

**Solutions:**
1. Double-check the password in `phoenix.conf`
2. Make sure there are no extra spaces when copying
3. Restart phoenixd after any config changes

### "Network unreachable" Error

**Cause:** Dashboard cannot reach the phoenixd server.

**Solutions:**
1. Verify the IP address is correct
2. Check if both devices are on the same network
3. Try pinging the server: `ping 192.168.1.100`
4. Check for VPN or firewall issues

### "CORS error" in Browser Console

**Cause:** Phoenixd doesn't have CORS headers configured.

**Solutions:**
1. The dashboard backend handles this - make sure you're connecting through the dashboard's backend API, not directly from the browser
2. If using a reverse proxy, ensure it adds proper CORS headers

---

## Advanced: SSH Tunneling

If you can't open ports directly, use SSH tunneling:

```bash
# On your local machine
ssh -L 9740:localhost:9740 user@your-server.com
```

Then connect to:
```
http://127.0.0.1:9740
```

The SSH tunnel securely forwards the connection.

---

## Advanced: Using with Tailscale

If both machines are on Tailscale:

1. Install Tailscale on both machines
2. Find your phoenixd machine's Tailscale IP: `tailscale ip`
3. Use that IP in the dashboard: `http://100.x.x.x:9740`

Or use Magic DNS:
```
http://my-phoenixd-server.tailnet-name.ts.net:9740
```

---

## Multiple Connections

You can add multiple phoenixd connections and switch between them:

- **Use cases:**
  - Mainnet and testnet nodes
  - Personal and business nodes
  - Hot and cold wallets

- **Limitations:**
  - Only one connection can be active at a time
  - Recurring payments are tied to the connection they were created on
  - Contact metadata is stored per-dashboard, not per-connection

---

## Security Best Practices

1. **Never expose phoenixd directly to the internet** - Use VPN, SSH tunnel, or reverse proxy
2. **Use strong API passwords** - The default generated password is usually sufficient
3. **Keep phoenixd updated** - Run the latest version for security patches
4. **Backup your seed phrase** - Always have your 12-word seed backed up securely
5. **Use HTTPS for remote access** - If exposing to the internet, put behind a reverse proxy with TLS

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Find phoenix.conf | `~/.phoenix/phoenix.conf` (Linux) |
| Get API password | `grep http-password ~/.phoenix/phoenix.conf` |
| Check phoenixd status | `ps aux \| grep phoenixd` |
| Default port | `9740` |
| Test connection | Settings → Network → Test Connection |

---

## Related Documentation

- [Installation Guide](installation.md) - Setting up the dashboard
- [Mobile Wallet Setup](mobile-wallet-setup.md) - Remote access via Tailscale
- [Configuration](configuration.md) - Environment variables and settings
