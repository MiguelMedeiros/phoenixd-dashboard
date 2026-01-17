# API Reference

The backend exposes a REST API for interacting with your phoenixd node.

**Base URL:** `http://localhost:4001`

---

## Payments

| Method | Endpoint                      | Description           |
| ------ | ----------------------------- | --------------------- |
| POST   | `/api/phoenixd/createinvoice` | Create Bolt11 invoice |
| POST   | `/api/phoenixd/createoffer`   | Create Bolt12 offer   |
| GET    | `/api/phoenixd/getlnaddress`  | Get Lightning address |
| POST   | `/api/phoenixd/payinvoice`    | Pay Bolt11 invoice    |
| POST   | `/api/phoenixd/payoffer`      | Pay Bolt12 offer      |
| POST   | `/api/phoenixd/paylnaddress`  | Pay Lightning address |
| POST   | `/api/phoenixd/sendtoaddress` | Send on-chain         |

---

## Node

| Method | Endpoint                   | Description             |
| ------ | -------------------------- | ----------------------- |
| GET    | `/api/node/info`           | Node information        |
| GET    | `/api/node/balance`        | Balance                 |
| GET    | `/api/node/channels`       | List channels           |
| POST   | `/api/node/channels/close` | Close channel           |
| GET    | `/api/node/estimatefees`   | Estimate liquidity fees |

---

## Payment History

| Method | Endpoint                       | Description            |
| ------ | ------------------------------ | ---------------------- |
| GET    | `/api/payments/incoming`       | List incoming payments |
| GET    | `/api/payments/incoming/:hash` | Get incoming payment   |
| GET    | `/api/payments/outgoing`       | List outgoing payments |
| GET    | `/api/payments/outgoing/:id`   | Get outgoing payment   |

---

## LNURL

| Method | Endpoint              | Description    |
| ------ | --------------------- | -------------- |
| POST   | `/api/lnurl/pay`      | LNURL Pay      |
| POST   | `/api/lnurl/withdraw` | LNURL Withdraw |
| POST   | `/api/lnurl/auth`     | LNURL Auth     |

---

## Contacts

| Method | Endpoint                            | Description                |
| ------ | ----------------------------------- | -------------------------- |
| GET    | `/api/contacts`                     | List all contacts          |
| GET    | `/api/contacts/:id`                 | Get contact by ID          |
| POST   | `/api/contacts`                     | Create new contact         |
| PUT    | `/api/contacts/:id`                 | Update contact             |
| DELETE | `/api/contacts/:id`                 | Delete contact             |
| POST   | `/api/contacts/:id/addresses`       | Add address to contact     |
| PUT    | `/api/contacts/:id/addresses/:addrId` | Update address           |
| DELETE | `/api/contacts/:id/addresses/:addrId` | Delete address           |
| GET    | `/api/contacts/:id/payments`        | Get contact payment history|

### Contact Address Types

- `lightning_address` - Lightning Address (user@domain.com)
- `node_id` - Node public key
- `bolt12_offer` - BOLT12 offer (lno1...)

---

## Categories

| Method | Endpoint              | Description           |
| ------ | --------------------- | --------------------- |
| GET    | `/api/categories`     | List all categories   |
| GET    | `/api/categories/:id` | Get category by ID    |
| POST   | `/api/categories`     | Create new category   |
| PUT    | `/api/categories/:id` | Update category       |
| DELETE | `/api/categories/:id` | Delete category       |

---

## Payment Metadata

| Method | Endpoint                              | Description                    |
| ------ | ------------------------------------- | ------------------------------ |
| GET    | `/api/payment-metadata/:identifier`   | Get metadata by hash/ID        |
| PUT    | `/api/payment-metadata/:identifier`   | Create/update payment metadata |
| GET    | `/api/payment-metadata/by-category/:id` | Get payments by category     |
| GET    | `/api/payment-metadata/by-contact/:id`  | Get payments by contact      |
| POST   | `/api/payment-metadata/batch`         | Batch get metadata             |

---

## Recurring Payments

| Method | Endpoint                              | Description                    |
| ------ | ------------------------------------- | ------------------------------ |
| GET    | `/api/recurring-payments`             | List recurring payments        |
| GET    | `/api/recurring-payments/:id`         | Get recurring payment          |
| POST   | `/api/recurring-payments`             | Create recurring payment       |
| PUT    | `/api/recurring-payments/:id`         | Update recurring payment       |
| DELETE | `/api/recurring-payments/:id`         | Delete recurring payment       |
| GET    | `/api/recurring-payments/:id/executions` | Get execution history       |
| POST   | `/api/recurring-payments/:id/execute` | Execute payment now            |

### Frequencies

- `every_minute`, `every_5_minutes`, `every_15_minutes`, `every_30_minutes`
- `hourly`, `daily`, `weekly`, `monthly`

---

## Phoenixd Connections (Multi-Node)

| Method | Endpoint                                | Description                |
| ------ | --------------------------------------- | -------------------------- |
| GET    | `/api/phoenixd-connections`             | List all connections       |
| GET    | `/api/phoenixd-connections/active`      | Get active connection      |
| POST   | `/api/phoenixd-connections`             | Create new connection      |
| PUT    | `/api/phoenixd-connections/:id`         | Update connection          |
| DELETE | `/api/phoenixd-connections/:id`         | Delete connection          |
| POST   | `/api/phoenixd-connections/:id/activate`| Switch to this connection  |
| POST   | `/api/phoenixd-connections/:id/test`    | Test saved connection      |
| POST   | `/api/phoenixd-connections/test`        | Test connection (unsaved)  |

---

## WebSocket

| Protocol | Endpoint | Description                     |
| -------- | -------- | ------------------------------- |
| WS       | `/ws`    | Real-time payment notifications |

### WebSocket Events

Connect to `ws://localhost:4001/ws` to receive real-time events:

```javascript
const ws = new WebSocket('ws://localhost:4001/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Payment received:', data);
};
```

---

## Remote Access (Tailscale)

| Method | Endpoint                     | Description               |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/api/tailscale/status`      | Get Tailscale status      |
| POST   | `/api/tailscale/enable`      | Start Tailscale container |
| POST   | `/api/tailscale/disable`     | Stop Tailscale container  |
| POST   | `/api/tailscale/auth-key`    | Save auth key             |
| DELETE | `/api/tailscale/auth-key`    | Remove auth key           |
| POST   | `/api/tailscale/refresh-dns` | Refresh Magic DNS name    |
| GET    | `/api/config/urls`           | Get dynamic URLs          |

---

## Authentication

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| GET    | `/api/auth/status`    | Check auth status    |
| POST   | `/api/auth/login`     | Login with password  |
| POST   | `/api/auth/logout`    | Logout               |
| POST   | `/api/auth/setup`     | Set up password      |
| POST   | `/api/auth/change`    | Change password      |

---

## Tor

| Method | Endpoint           | Description        |
| ------ | ------------------ | ------------------ |
| GET    | `/api/tor/status`  | Get Tor status     |
| POST   | `/api/tor/enable`  | Enable Tor proxy   |
| POST   | `/api/tor/disable` | Disable Tor proxy  |

---

## Cloudflare Tunnel

| Method | Endpoint                  | Description              |
| ------ | ------------------------- | ------------------------ |
| GET    | `/api/cloudflared/status` | Get tunnel status        |
| PUT    | `/api/cloudflared/token`  | Save tunnel token        |
| DELETE | `/api/cloudflared/token`  | Remove tunnel token      |
| PUT    | `/api/cloudflared/ingress`| Configure ingress rules  |
| POST   | `/api/cloudflared/enable` | Start tunnel container   |
| POST   | `/api/cloudflared/disable`| Stop tunnel container    |
| GET    | `/api/cloudflared/logs`   | Get container logs       |
| DELETE | `/api/cloudflared/image`  | Remove Docker image      |

---

## Docker

| Method | Endpoint                           | Description                |
| ------ | ---------------------------------- | -------------------------- |
| GET    | `/api/docker/containers`           | List project containers    |
| GET    | `/api/docker/containers/:name`     | Get container info         |
| POST   | `/api/docker/containers/:name/start` | Start container          |
| POST   | `/api/docker/containers/:name/stop`  | Stop container           |
| GET    | `/api/docker/phoenixd/status`      | Get phoenixd container status |
| POST   | `/api/docker/phoenixd/start`       | Start phoenixd container   |
| POST   | `/api/docker/phoenixd/stop`        | Stop phoenixd container    |
