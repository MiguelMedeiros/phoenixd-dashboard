# Phoenixd Donations App

A beautiful, customizable donation page for accepting Lightning payments through Phoenixd Dashboard.

![Donations App](https://img.shields.io/badge/Lightning-Payments-orange?logo=bitcoin&logoColor=white)

## Features

- **Beautiful UI**: Modern, responsive design with dark/light theme support
- **BOLT11 Invoices**: Dynamic invoices for specific amounts
- **BOLT12 Offers**: Static QR code that never expires (any amount)
- **Customizable**: Configure title, subtitle, logo, suggested amounts, and more
- **Real-time Updates**: Instant payment confirmation via webhooks
- **QR Code Payments**: Easy scanning for mobile wallets
- **Recent Donations**: Display recent contributors to encourage more donations
- **Webhook Integration**: Automatic notifications when payments are received

## Quick Start

### Option 1: Install from Phoenixd Dashboard

1. Open Phoenixd Dashboard > Apps
2. Click "Install App"
3. Select "Marketplace" tab
4. Choose "Donations Page"
5. Configure your settings
6. Click Install

### Option 2: Manual Docker Installation

```bash
# Build the image
cd apps/donations
npm install
npm run build
docker build -t phoenixd-donations .

# Run locally
docker run -p 3000:3000 \
  -e PHOENIXD_DASHBOARD_URL=http://host.docker.internal:4000 \
  -e PHOENIXD_APP_API_KEY=your_api_key \
  -e PHOENIXD_WEBHOOK_SECRET=your_secret \
  -e DONATIONS_TITLE="Support My Project" \
  phoenixd-donations
```

## Configuration

### Environment Variables

All environment variables are optional and have sensible defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `DONATIONS_TITLE` | "Support Our Project" | Main page title |
| `DONATIONS_SUBTITLE` | "Your contribution helps..." | Page subtitle |
| `DONATIONS_LOGO` | (none) | URL to a logo image |
| `DONATIONS_THEME` | "dark" | Theme: "dark" or "light" |
| `DONATIONS_AMOUNTS` | "1000,5000,10000,50000" | Suggested amounts in sats (comma-separated) |
| `DONATIONS_SUCCESS_MESSAGE` | "Thank you for your..." | Message shown after successful payment |
| `DONATIONS_CURRENCY` | "sats" | Currency label to display |

### Auto-Injected Variables

These are automatically injected by Phoenixd Dashboard:

| Variable | Description |
|----------|-------------|
| `PHOENIXD_DASHBOARD_URL` | Backend URL for API calls |
| `PHOENIXD_APP_API_KEY` | API key for authenticated requests |
| `PHOENIXD_WEBHOOK_SECRET` | Secret for verifying webhooks |
| `PHOENIXD_NODE_ID` | Your Lightning node's public key |
| `PHOENIXD_CHAIN` | Network: "mainnet" or "testnet" |

## API Endpoints

### GET /health
Health check endpoint (required by Dashboard).

```json
{ "status": "ok", "app": "phoenixd-donations", "version": "1.0.0" }
```

### GET /api/config
Get page configuration.

### POST /api/donations/create
Create a new donation invoice.

**Request:**
```json
{
  "amountSat": 1000,
  "donorName": "John Doe",
  "message": "Keep up the great work!"
}
```

**Response:**
```json
{
  "paymentHash": "abc123...",
  "invoice": "lnbc...",
  "qrCode": "data:image/png;base64,...",
  "amountSat": 1000
}
```

### GET /api/donations/status/:paymentHash
Check donation payment status.

### GET /api/donations/recent
Get recent donations for display.

### POST /webhook
Webhook endpoint for payment notifications.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Customization

### Adding a Custom Logo

Set the `DONATIONS_LOGO` environment variable to a URL:

```bash
DONATIONS_LOGO=https://example.com/logo.png
```

Or host the logo locally by placing it in the `public` folder and using:

```bash
DONATIONS_LOGO=/my-logo.png
```

### Custom Suggested Amounts

Set comma-separated values in sats:

```bash
DONATIONS_AMOUNTS=500,1000,2100,5000,10000,21000
```

### Light Theme

```bash
DONATIONS_THEME=light
```

## BOLT12 Support

The app automatically creates a BOLT12 offer on startup. This provides:

- **Static QR Code**: Never expires, can be printed or embedded anywhere
- **Any Amount**: Donor chooses how much to send
- **Reusable**: Multiple payments to the same offer
- **Compatible Wallets**: Phoenix (ACINQ), Core Lightning, and others

### How it works

1. On startup, the app calls the Dashboard API to create a BOLT12 offer
2. The offer is displayed as an option on the donation page
3. Donors can choose between BOLT11 (fixed amount) or BOLT12 (any amount)
4. BOLT12 payments are detected via the same webhook system

### BOLT12 vs BOLT11

| Feature | BOLT11 | BOLT12 |
|---------|--------|--------|
| Expiry | 1 hour | Never |
| Amount | Fixed | Any |
| Reusable | No | Yes |
| Wallet Support | All Lightning wallets | Phoenix, CLN |

## Webhook Events

The app subscribes to `payment_received` events to detect when donations are paid.

When a payment is received:
1. The invoice status is updated to "paid"
2. The donation is added to the recent donations list
3. The success view is shown to the donor

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](../../CONTRIBUTING.md) for details.
