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
