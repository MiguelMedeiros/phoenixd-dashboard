# Cloud Deployment

Deploy Phoenixd Dashboard to popular cloud platforms with one click.

## One-Click Deploy Options

### Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/MiguelMedeiros/phoenixd-dashboard)

Railway offers the best Docker Compose support and automatic PostgreSQL provisioning.

**Pros:**
- Native Docker Compose support
- Automatic PostgreSQL database
- Easy environment variable management
- Free tier available

**Setup:**
1. Click the deploy button
2. Connect your GitHub account
3. Configure environment variables:
   - `PHOENIXD_URL`: Your phoenixd instance URL
   - `PHOENIXD_PASSWORD`: Your phoenixd password
4. Deploy!

---

### Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/MiguelMedeiros/phoenixd-dashboard)

Render provides managed PostgreSQL and automatic SSL.

**Pros:**
- Managed PostgreSQL included
- Automatic SSL certificates
- Blueprint-based deployment
- Free tier available

**Setup:**
1. Click the deploy button
2. Connect your GitHub account
3. Review the services (backend, frontend, database)
4. Configure secrets:
   - `PHOENIXD_URL`: Your phoenixd instance URL
   - `PHOENIXD_PASSWORD`: Your phoenixd password
5. Deploy!

---

### DigitalOcean App Platform

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/MiguelMedeiros/phoenixd-dashboard/tree/main)

DigitalOcean offers reliable infrastructure with predictable pricing.

**Pros:**
- Managed PostgreSQL
- Automatic scaling
- Built-in monitoring
- $200 free credit for new accounts

**Setup:**
1. Click the deploy button
2. Connect your GitHub repository
3. Configure environment variables
4. Select your plan
5. Deploy!

---

### Heroku

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/MiguelMedeiros/phoenixd-dashboard)

Heroku is a classic PaaS with easy deployment.

**Pros:**
- Simple deployment process
- PostgreSQL add-on available
- Easy scaling

**Setup:**
1. Click the deploy button
2. Create or log in to your Heroku account
3. Configure environment variables
4. Deploy!

---

## Important Notes

### External Phoenixd Instance Required

All cloud deployments require an **external phoenixd instance** running somewhere accessible. The cloud deployment only hosts the dashboard, not the phoenixd node itself.

Options for running phoenixd:
- **VPS**: Run phoenixd on a separate VPS (recommended)
- **Home Server**: Run phoenixd at home with port forwarding
- **Tailscale**: Connect cloud dashboard to home phoenixd via Tailscale

See [External Phoenixd](external-phoenixd.md) for detailed instructions.

### Security Considerations

1. **Use HTTPS**: All cloud platforms provide automatic SSL
2. **Strong Password**: Set a strong `PHOENIXD_PASSWORD`
3. **Network Security**: Ensure phoenixd is only accessible from your dashboard
4. **Backup**: Regularly backup your phoenixd data and seed phrase

### Limitations

Some features may not work in cloud environments:

- **Tor Hidden Service**: Requires special network configuration
- **Tailscale**: May require additional setup
- **Docker Socket Access**: Not available in most cloud platforms

For full functionality, consider [self-hosting with Docker](installation.md).

---

## Environment Variables

All cloud platforms require these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PHOENIXD_URL` | Yes | URL of your phoenixd instance |
| `PHOENIXD_PASSWORD` | Yes | Password for phoenixd authentication |
| `FRONTEND_URL` | Auto | Set automatically by most platforms |
| `DATABASE_URL` | Auto | Set automatically when using managed database |

---

## Troubleshooting

### Connection Refused to Phoenixd

- Ensure phoenixd is running and accessible from the internet
- Check firewall rules allow connections on port 9740
- Verify the `PHOENIXD_URL` is correct

### Database Connection Issues

- Most platforms auto-configure the database
- Check if the database service is running
- Verify `DATABASE_URL` is set correctly

### WebSocket Connection Failed

- Ensure `NEXT_PUBLIC_WS_URL` points to the correct WebSocket endpoint
- Check if your platform supports WebSocket connections
