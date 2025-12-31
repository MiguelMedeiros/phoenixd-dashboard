import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { phoenixdRouter } from './routes/phoenixd.js';
import { paymentsRouter } from './routes/payments.js';
import { nodeRouter } from './routes/node.js';
import { lnurlRouter } from './routes/lnurl.js';
import { authRouter } from './routes/auth.js';
import { PhoenixdService } from './services/phoenixd.js';
import { cleanupExpiredSessions } from './middleware/auth.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

export const prisma = new PrismaClient();
export const phoenixd = new PhoenixdService();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/phoenixd', phoenixdRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/node', nodeRouter);
app.use('/api/lnurl', lnurlRouter);

// WebSocket clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Function to broadcast payment events to all connected clients
export function broadcastPayment(event: object) {
  const message = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Connect to phoenixd WebSocket for payment notifications
async function connectPhoenixdWebSocket() {
  const phoenixdWsUrl = process.env.PHOENIXD_URL?.replace('http', 'ws') + '/websocket';
  const password = process.env.PHOENIXD_PASSWORD || '';

  console.log('Connecting to phoenixd WebSocket...');

  try {
    const ws = new WebSocket(phoenixdWsUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`:${password}`).toString('base64'),
      },
    });

    ws.on('open', () => {
      console.log('Connected to phoenixd WebSocket');
    });

    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());
        console.log('Received phoenixd event:', event);

        // Broadcast to all connected clients FIRST (before any DB operations)
        broadcastPayment(event);

        // Store the payment in database (don't block on errors)
        if (event.type === 'payment_received') {
          try {
            await prisma.paymentLog.create({
              data: {
                type: 'incoming',
                paymentHash: event.paymentHash || 'unknown',
                amountSat: event.amountSat || 0,
                status: 'completed',
                rawData: event,
              },
            });
          } catch (dbError) {
            console.error('Error saving payment to database:', dbError);
          }
        }
      } catch (error) {
        console.error('Error processing phoenixd event:', error);
      }
    });

    ws.on('close', () => {
      console.log('Disconnected from phoenixd WebSocket, reconnecting in 5s...');
      setTimeout(connectPhoenixdWebSocket, 5000);
    });

    ws.on('error', (error) => {
      console.error('Phoenixd WebSocket error:', error);
    });
  } catch (error) {
    console.error('Failed to connect to phoenixd WebSocket:', error);
    setTimeout(connectPhoenixdWebSocket, 5000);
  }
}

// Start server
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);

  // Connect to phoenixd WebSocket after a delay
  setTimeout(connectPhoenixdWebSocket, 3000);

  // Cleanup expired sessions every hour
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
  // Also run cleanup on startup
  cleanupExpiredSessions();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});
