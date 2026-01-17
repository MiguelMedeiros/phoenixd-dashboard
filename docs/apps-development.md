# Phoenixd Dashboard Apps Development Guide

This guide explains how to create apps that integrate with Phoenixd Dashboard. Apps are Docker containers that can receive webhook notifications and interact with the Phoenixd node through the dashboard's API gateway.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Webhook Events](#webhook-events)
- [API Gateway](#api-gateway)
- [BOLT12 Offers](#bolt12-offers)
- [Example: Donations App](#example-donations-app)
- [Testing Your App](#testing-your-app)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Apps in Phoenixd Dashboard can:

- **Receive webhooks** when payments are received, sent, or channels change
- **Call the API gateway** to create invoices, make payments, check balance, etc.
- **Auto-configure** using environment variables injected by the dashboard
- **Create BOLT12 offers** for static payment links that never expire
- **Serve web interfaces** accessible through the dashboard

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phoenixd Dashboard                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  Frontend   │    │   Backend   │    │  Phoenixd Node      │ │
│  │  (Next.js)  │◄──►│  (Express)  │◄──►│  (Lightning)        │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                    │
│                            │ Webhooks & API Gateway             │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Apps (Docker Containers)                  ││
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               ││
│  │  │ Donations │  │  Custom   │  │  Custom   │  ...          ││
│  │  │   Page    │  │   App 1   │  │   App 2   │               ││
│  │  └───────────┘  └───────────┘  └───────────┘               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Create a Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000

# Health check endpoint is required
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

### 2. Implement Required Endpoints

Your app must expose:

#### Health Check Endpoint

```javascript
// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

#### Webhook Endpoint

```javascript
// POST /webhook (or custom path configured in dashboard)
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const event = req.body;

  // Verify signature (optional but recommended)
  if (!verifySignature(req.body, signature, process.env.PHOENIXD_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Handle the event
  switch (event.event) {
    case 'payment_received':
      handlePaymentReceived(event.data);
      break;
    case 'payment_sent':
      handlePaymentSent(event.data);
      break;
    // ...
  }

  res.json({ received: true });
});
```

### 3. Use Environment Variables

The dashboard automatically injects these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `PHOENIXD_DASHBOARD_URL` | Backend URL for API calls | `http://phoenixd-backend:4000` |
| `PHOENIXD_APP_API_KEY` | API key for authenticated requests | `phxapp_abc123...` |
| `PHOENIXD_WEBHOOK_SECRET` | Secret for verifying webhook signatures | `whsec_xyz789...` |
| `PHOENIXD_NODE_ID` | The Lightning node's public key | `02abc...` |
| `PHOENIXD_CHAIN` | Network: `mainnet` or `testnet` | `mainnet` |

### Custom Environment Variables

You can define custom environment variables when installing the app. These are useful for app-specific configuration:

```typescript
// Access custom env vars in your app
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CONFIG = process.env.MY_CUSTOM_CONFIG || 'default';
```

## Webhook Events

### Event Format

All webhooks are POST requests with JSON body:

```json
{
  "event": "payment_received",
  "timestamp": 1705500000000,
  "data": { ... }
}
```

### Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Webhook-Event` | Event type (e.g., `payment_received`) |
| `X-Webhook-Timestamp` | Unix timestamp in milliseconds |
| `X-Webhook-Signature` | HMAC-SHA256 signature of the payload |
| `X-App-Id` | Your app's slug |

### Available Events

#### `payment_received`

Triggered when a payment is received.

```json
{
  "event": "payment_received",
  "timestamp": 1705500000000,
  "data": {
    "paymentHash": "abc123...",
    "amountSat": 1000,
    "description": "Test payment",
    "externalId": "order-123",
    "receivedAt": 1705500000000,
    "payerKey": "02abc...",
    "payerNote": "Thanks!"
  }
}
```

#### `payment_sent`

Triggered when a payment is sent.

```json
{
  "event": "payment_sent",
  "timestamp": 1705500000000,
  "data": {
    "paymentId": "xyz789...",
    "paymentHash": "abc123...",
    "amountSat": 500,
    "feesSat": 1,
    "destination": "lnbc...",
    "sentAt": 1705500000000
  }
}
```

#### `channel_opened` / `channel_closed`

```json
{
  "event": "channel_opened",
  "timestamp": 1705500000000,
  "data": {
    "channelId": "channel123...",
    "capacitySat": 1000000,
    "fundingTxId": "txid...",
    "timestamp": 1705500000000
  }
}
```

### Verifying Webhook Signatures

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSignature)
  );
}
```

## API Gateway

Apps can make authenticated requests to the dashboard backend to interact with the Phoenixd node.

### Authentication

Include your API key in the Authorization header:

```javascript
const response = await fetch(`${process.env.PHOENIXD_DASHBOARD_URL}/api/apps-gateway/balance`, {
  headers: {
    'Authorization': `Bearer ${process.env.PHOENIXD_APP_API_KEY}`,
    'Content-Type': 'application/json',
  },
});
```

### Available Endpoints

#### Node Information

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/apps-gateway/info` | GET | - | Get app info |
| `/api/apps-gateway/node` | GET | `read:node` | Get node info |
| `/api/apps-gateway/balance` | GET | `read:balance` | Get balance |
| `/api/apps-gateway/channels` | GET | `read:channels` | List channels |
| `/api/apps-gateway/lnaddress` | GET | `read:node` | Get Lightning Address |

#### Payments

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/apps-gateway/payments/incoming` | GET | `read:payments` | List incoming payments |
| `/api/apps-gateway/payments/incoming/:hash` | GET | `read:payments` | Get incoming payment |
| `/api/apps-gateway/payments/outgoing` | GET | `read:payments` | List outgoing payments |
| `/api/apps-gateway/payments/outgoing/:id` | GET | `read:payments` | Get outgoing payment |

#### Create Invoices

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/apps-gateway/invoices` | POST | `write:invoices` | Create invoice |
| `/api/apps-gateway/offers` | POST | `write:invoices` | Create BOLT12 offer |

**Create Invoice Request:**

```json
{
  "amountSat": 1000,
  "description": "My App Payment",
  "expirySeconds": 3600,
  "externalId": "order-123"
}
```

#### Send Payments

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/apps-gateway/pay/invoice` | POST | `write:payments` | Pay BOLT11 invoice |
| `/api/apps-gateway/pay/offer` | POST | `write:payments` | Pay BOLT12 offer |
| `/api/apps-gateway/pay/lnaddress` | POST | `write:payments` | Pay Lightning Address |

**Pay Invoice Request:**

```json
{
  "invoice": "lnbc...",
  "amountSat": 1000  // Optional, for zero-amount invoices
}
```

#### Utilities

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/apps-gateway/decode/invoice` | POST | `read:payments` | Decode BOLT11 |
| `/api/apps-gateway/decode/offer` | POST | `read:payments` | Decode BOLT12 |
| `/api/apps-gateway/estimate-fees` | GET | `read:balance` | Estimate liquidity fees |

### Rate Limiting

Each app is limited to **100 requests per minute**. The API returns `429 Too Many Requests` when exceeded.

## Permissions

When installing an app, you can configure which API permissions it has:

| Permission | Description |
|------------|-------------|
| `read:balance` | Read wallet balance |
| `read:payments` | Read payment history |
| `read:channels` | Read channel information |
| `read:node` | Read node info and Lightning Address |
| `write:invoices` | Create invoices and offers |
| `write:payments` | Send payments |

## Example Apps

These are examples to help you understand how to build apps for Phoenixd Dashboard.

### Telegram Notification Bot

A simple bot that sends Telegram messages when payments are received.

**index.js:**

```javascript
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'payment_received') {
    const message = `⚡ Payment Received!\n\nAmount: ${data.amountSat} sats\nHash: ${data.paymentHash.slice(0, 16)}...`;
    await bot.sendMessage(chatId, message);
  }

  res.json({ received: true });
});

app.listen(3000, () => {
  console.log('Telegram bot listening on port 3000');
});
```

**Environment Variables Required:**

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `TELEGRAM_CHAT_ID` - Chat ID to send messages to

### Nostr Zap Bot

A bot that automatically sends zaps when payments are received.

```javascript
const express = require('express');
const { nip57 } = require('nostr-tools');

const app = express();
app.use(express.json());

const DASHBOARD_URL = process.env.PHOENIXD_DASHBOARD_URL;
const API_KEY = process.env.PHOENIXD_APP_API_KEY;

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'payment_received' && data.payerNote?.startsWith('nostr:')) {
    // Extract nostr pubkey and send zap back
    const pubkey = data.payerNote.replace('nostr:', '');
    
    // Create invoice for the zap amount
    const response = await fetch(`${DASHBOARD_URL}/api/apps-gateway/pay/lnaddress`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: `${pubkey}@zap.stream`,
        amountSat: Math.floor(data.amountSat * 0.1), // 10% zap back
        message: 'Thanks for the zap! ⚡'
      }),
    });

    console.log('Zap sent:', await response.json());
  }

  res.json({ received: true });
});

app.listen(3000);
```

## Testing Your App

### Local Development

1. Build your Docker image:
   ```bash
   docker build -t my-phoenixd-app .
   ```

2. Run locally with test environment:
   ```bash
   docker run -p 3000:3000 \
     -e PHOENIXD_DASHBOARD_URL=http://host.docker.internal:4000 \
     -e PHOENIXD_APP_API_KEY=test_key \
     -e PHOENIXD_WEBHOOK_SECRET=test_secret \
     my-phoenixd-app
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```

4. Test the webhook endpoint:
   ```bash
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -d '{"event":"payment_received","timestamp":1705500000000,"data":{"paymentHash":"test","amountSat":1000}}'
   ```

### Installing in Dashboard

1. Push your image to a Docker registry (Docker Hub, GitHub Container Registry, etc.)
2. Open Phoenixd Dashboard > Apps
3. Click "Install App"
4. Select "Docker Image" and enter your image URL
5. Configure webhook events and environment variables
6. Click Install

## BOLT12 Offers

Apps can create BOLT12 offers for static payment links that never expire.

### Creating an Offer

```javascript
const response = await fetch(`${DASHBOARD_URL}/api/apps-gateway/offers`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    description: 'My App Donations',
    // amountSat is optional - omit for any-amount offers
  }),
});

const offer = await response.json(); // Returns the offer string directly
console.log(offer); // "lno1pg..."
```

### Benefits of BOLT12

- **Never expires** - Same QR code works forever
- **Any amount** - Payer chooses how much to send
- **Reusable** - Multiple payments to the same offer
- **Payer privacy** - No invoice reuse tracking

### Compatible Wallets

- Phoenix (ACINQ)
- Core Lightning
- LDK-based wallets (coming soon)

## Example: Donations App

The Donations app is included as a reference implementation. It demonstrates:

- Creating BOLT11 invoices for fixed amounts
- Creating BOLT12 offers for any-amount donations
- Handling webhook notifications
- Serving a web UI
- QR code generation

### File Structure

```
apps/donations/
├── src/
│   └── index.ts       # Express server
├── public/
│   ├── index.html     # UI
│   ├── styles.css     # Styling
│   └── app.js         # Frontend logic
├── Dockerfile
├── package.json
└── README.md
```

### Key Features

#### 1. Invoice Creation

```typescript
async function createInvoice(amountSat: number, description: string) {
  const response = await fetch(`${DASHBOARD_URL}/api/apps-gateway/invoices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amountSat, description }),
  });
  return response.json();
}
```

#### 2. BOLT12 Offer (created on startup)

```typescript
async function initializeBolt12Offer() {
  const response = await fetch(`${DASHBOARD_URL}/api/apps-gateway/offers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Donations',
    }),
  });
  const offer = await response.json();
  // Generate QR code for the offer
}
```

#### 3. Webhook Handler

```typescript
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'payment_received') {
    // Mark invoice as paid
    const invoice = pendingInvoices.get(data.paymentHash);
    if (invoice) {
      invoice.status = 'paid';
      recentDonations.push({ ... });
    }
  }
  
  res.json({ received: true });
});
```

#### 4. Configuration via Environment Variables

```typescript
const PAGE_TITLE = process.env.DONATIONS_TITLE || 'Support Our Project';
const PAGE_THEME = process.env.DONATIONS_THEME || 'dark';
const SUGGESTED_AMOUNTS = process.env.DONATIONS_AMOUNTS || '1000,5000,10000,50000';
```

### Running the Donations App

```bash
# Build the image
cd apps/donations
npm install
npm run build
docker build -t phoenixd-donations:latest .

# Run locally (after installing via dashboard)
docker run -d \
  --name my-donations \
  --network phoenixd-dashboard_phoenixd-network \
  -p 3001:3000 \
  -e PHOENIXD_DASHBOARD_URL=http://phoenixd-backend:4000 \
  -e PHOENIXD_APP_API_KEY=your_api_key \
  -e DONATIONS_TITLE="My Donations" \
  -e DONATIONS_THEME=dark \
  phoenixd-donations:latest
```

### Customization Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `DONATIONS_TITLE` | Page title | "Support Our Project" |
| `DONATIONS_SUBTITLE` | Page subtitle | "Your contribution helps..." |
| `DONATIONS_LOGO` | URL to logo image | (none) |
| `DONATIONS_THEME` | `dark` or `light` | `dark` |
| `DONATIONS_AMOUNTS` | Comma-separated amounts in sats | `1000,5000,10000,50000` |
| `DONATIONS_SUCCESS_MESSAGE` | Message after payment | "Thank you!" |
| `DONATIONS_CURRENCY` | Display currency label | `sats` |

## Accessing App UI

Apps with web interfaces can be accessed through the dashboard proxy:

```
/api/apps/open/{app-slug}/
```

This allows users to access app UIs without exposing additional ports. The dashboard handles authentication and proxies requests to the app container.

### Benefits

- No additional port configuration needed
- Authentication handled by dashboard
- Works with any HTTP-based UI
- Supports relative URLs automatically

## Best Practices

1. **Always implement health checks** - The dashboard monitors your app's health
2. **Verify webhook signatures** - Protect against spoofed webhooks
3. **Handle errors gracefully** - Return appropriate HTTP status codes
4. **Log important events** - Logs are visible in the dashboard
5. **Use environment variables** - Never hardcode secrets
6. **Respect rate limits** - Implement backoff for API calls
7. **Keep images small** - Use Alpine base images when possible

## Troubleshooting

### App won't start

- Check container logs in the dashboard (expand app → Container Logs)
- Verify the health endpoint responds with 200 OK:
  ```bash
  curl http://localhost:3000/health
  ```
- Ensure the port matches the configured internal port (default: 3000)
- Check Docker network connectivity:
  ```bash
  docker network inspect phoenixd-dashboard_phoenixd-network
  ```

### Webhooks not received

- Verify the webhook path is correct (default: `/webhook`)
- Check that the container is running and healthy
- Verify the app is subscribed to the correct events
- Check webhook logs in the dashboard (expand app → Recent Webhooks)
- Test webhook manually:
  ```bash
  curl -X POST http://localhost:3000/webhook \
    -H "Content-Type: application/json" \
    -d '{"event":"payment_received","data":{"paymentHash":"test","amountSat":1000}}'
  ```

### API calls failing

- Check that the API key is correct and not expired
- Verify the app has the required permissions
- Check for rate limiting (429 responses)
- Test API connectivity from inside the container:
  ```bash
  docker exec your-app curl http://phoenixd-backend:4000/api/apps-gateway/info \
    -H "Authorization: Bearer YOUR_API_KEY"
  ```

### BOLT12 offer not created

- Verify the app has `write:invoices` permission
- Check that phoenixd supports BOLT12 (requires recent version)
- Check container logs for offer creation errors

### Container networking issues

Apps run in the same Docker network as the dashboard. If you're having connectivity issues:

```bash
# List containers in the network
docker network inspect phoenixd-dashboard_phoenixd-network

# Test connectivity from app container
docker exec your-app ping phoenixd-backend

# Check DNS resolution
docker exec your-app nslookup phoenixd-backend
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Authentication required` | Missing or invalid API key | Check `PHOENIXD_APP_API_KEY` |
| `Permission denied` | Missing permission | Add required permission in app settings |
| `Container not found` | Docker networking issue | Verify network configuration |
| `Health check failed` | `/health` not responding | Implement health endpoint |
| `429 Too Many Requests` | Rate limit exceeded | Implement backoff/retry logic |

## Publishing Your App

### Docker Hub

```bash
# Build and tag
docker build -t yourusername/your-app:latest .

# Push to Docker Hub
docker login
docker push yourusername/your-app:latest
```

### GitHub Container Registry

```bash
# Build and tag
docker build -t ghcr.io/yourusername/your-app:latest .

# Push to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker push ghcr.io/yourusername/your-app:latest
```

### App Metadata

When publishing, include these in your README:

- **Required permissions** - Which API permissions the app needs
- **Webhook events** - Which events the app handles
- **Environment variables** - Custom configuration options
- **Port** - Which port the app listens on (default: 3000)

## Support

For help with app development:

- Open an issue on [GitHub](https://github.com/AustinKelsworthy/phoenixd-dashboard)
- Join the community discussions
- Check existing apps in the `/apps` directory for reference
