import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
import { phoenixdRouter } from './routes/phoenixd.js';
import { paymentsRouter } from './routes/payments.js';
import { nodeRouter } from './routes/node.js';
import { lnurlRouter } from './routes/lnurl.js';
import { authRouter } from './routes/auth.js';
import { torRouter } from './routes/tor.js';
import { tailscaleRouter } from './routes/tailscale.js';
import { cloudflaredRouter } from './routes/cloudflared.js';
import { configRouter } from './routes/config.js';
import {
  dockerRouter,
  isProjectContainer,
  execInContainer,
  getContainerLogs,
} from './routes/docker.js';
import { PhoenixdService } from './services/phoenixd.js';
import { cleanupExpiredSessions, validateSessionFromCookie } from './middleware/auth.js';

const app = express();
const server = createServer(app);

// Main WebSocket server for payment notifications
const wss = new WebSocketServer({ noServer: true });

// WebSocket server for Docker logs
const wssLogs = new WebSocketServer({ noServer: true });

// WebSocket server for Docker terminal
const wssTerminal = new WebSocketServer({ noServer: true });

export const prisma = new PrismaClient();
export const phoenixd = new PhoenixdService();

// CORS configuration - allow localhost, Tailscale domains, and same root domain
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:4001',
];

// Extract root domain from a hostname (e.g., "api.example.com" -> "example.com")
function getRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  // Handle cases like "localhost" or IP addresses
  if (parts.length <= 2) return hostname;
  // Return last two parts (e.g., "miguelmedeiros.dev" from "phoenixd-api.miguelmedeiros.dev")
  return parts.slice(-2).join('.');
}

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (like mobile apps, curl, etc)
      if (!origin) {
        return callback(null, true);
      }

      // Allow "null" origin (Tor Browser sends this for privacy)
      if (origin === 'null') {
        return callback(null, true);
      }

      // Allow any Tor Hidden Service (.onion)
      if (origin.includes('.onion')) {
        return callback(null, true);
      }

      // Allow any Tailscale Magic DNS domain (.ts.net)
      if (origin.includes('.ts.net')) {
        return callback(null, true);
      }

      // Allow localhost with any port
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      // Allow configured origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Auto-detect: Allow any origin from the same root domain as the API
      // e.g., if API is at phoenixd-api.miguelmedeiros.dev, allow phoenixd.miguelmedeiros.dev
      try {
        const originUrl = new URL(origin);
        const originRootDomain = getRootDomain(originUrl.hostname);

        // Check if origin shares the same root domain as any of our configured origins
        // or if it matches a pattern like *.domain.com
        if (process.env.FRONTEND_URL) {
          const frontendUrl = new URL(process.env.FRONTEND_URL);
          const frontendRootDomain = getRootDomain(frontendUrl.hostname);
          if (originRootDomain === frontendRootDomain) {
            return callback(null, true);
          }
        }

        // Also check against NEXT_PUBLIC_API_URL if set (to infer the deployment domain)
        if (process.env.NEXT_PUBLIC_API_URL) {
          const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL);
          const apiRootDomain = getRootDomain(apiUrl.hostname);
          if (originRootDomain === apiRootDomain) {
            return callback(null, true);
          }
        }

        // Allow any HTTPS origin from a custom domain (not localhost)
        // This handles production deployments where both frontend and API share root domain
        if (originUrl.protocol === 'https:' && !originUrl.hostname.includes('localhost')) {
          // If the origin looks like a production domain (has TLD), allow it
          // This is a permissive approach for self-hosted deployments
          const parts = originUrl.hostname.split('.');
          if (parts.length >= 2) {
            console.log(`CORS auto-allowing HTTPS origin: ${origin}`);
            return callback(null, true);
          }
        }
      } catch {
        // Invalid URL, continue to rejection
      }

      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
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
app.use('/api/tor', torRouter);
app.use('/api/tailscale', tailscaleRouter);
app.use('/api/cloudflared', cloudflaredRouter);
app.use('/api/config', configRouter);
app.use('/api/docker', dockerRouter);

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

// Function to broadcast service status events (Cloudflared, Tor, Tailscale)
export function broadcastServiceEvent(event: {
  type:
    | 'cloudflared:connected'
    | 'cloudflared:disconnected'
    | 'cloudflared:error'
    | 'tor:connected'
    | 'tor:disconnected'
    | 'tailscale:connected'
    | 'tailscale:disconnected';
  message?: string;
}) {
  const message = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Parse cookies from request
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

// Handle WebSocket upgrade requests
server.on('upgrade', async (request: IncomingMessage, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = url.pathname;

  // Main WebSocket for payment notifications (no auth required for now)
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  // Docker logs WebSocket - requires auth
  if (pathname.startsWith('/ws/docker/logs/')) {
    const containerName = pathname.replace('/ws/docker/logs/', '');

    // Validate container name
    if (!isProjectContainer(containerName)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Validate session from cookie
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies['session'];

    const isValid = await validateSessionFromCookie(sessionId || '');
    if (!isValid) {
      console.log('Docker logs WebSocket auth failed for container:', containerName);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wssLogs.handleUpgrade(request, socket, head, (ws) => {
      wssLogs.emit('connection', ws, request, containerName);
    });
    return;
  }

  // Docker terminal WebSocket - requires auth
  if (pathname.startsWith('/ws/docker/exec/')) {
    const containerName = pathname.replace('/ws/docker/exec/', '');

    // Validate container name
    if (!isProjectContainer(containerName)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Validate session from cookie
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies['session'];

    const isValid = await validateSessionFromCookie(sessionId || '');
    if (!isValid) {
      console.log('Docker terminal WebSocket auth failed for container:', containerName);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wssTerminal.handleUpgrade(request, socket, head, (ws) => {
      wssTerminal.emit('connection', ws, request, containerName);
    });
    return;
  }

  // Unknown path
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// Parse Docker multiplexed stream
// Docker logs use 8-byte headers when not using TTY:
// - Byte 0: stream type (0=stdin, 1=stdout, 2=stderr)
// - Bytes 1-3: reserved
// - Bytes 4-7: payload size (big-endian)
function parseDockerLogChunk(buffer: Buffer): string {
  let result = '';
  let offset = 0;

  while (offset < buffer.length) {
    // Need at least 8 bytes for header
    if (offset + 8 > buffer.length) {
      // If we have remaining data without proper header, return it as-is
      result += buffer.slice(offset).toString('utf8');
      break;
    }

    // Read header
    const streamType = buffer.readUInt8(offset);
    const payloadSize = buffer.readUInt32BE(offset + 4);

    // Validate stream type (0, 1, or 2)
    if (streamType > 2) {
      // Invalid stream type, probably not multiplexed - return as-is
      result += buffer.slice(offset).toString('utf8');
      break;
    }

    // Skip header
    offset += 8;

    // Read payload
    if (offset + payloadSize <= buffer.length) {
      result += buffer.slice(offset, offset + payloadSize).toString('utf8');
      offset += payloadSize;
    } else {
      // Incomplete payload
      result += buffer.slice(offset).toString('utf8');
      break;
    }
  }

  return result;
}

// Handle Docker logs WebSocket connections
wssLogs.on(
  'connection',
  async (ws: WebSocket, _request: IncomingMessage, containerName: string) => {
    console.log(`Docker logs WebSocket connected for container: ${containerName}`);

    try {
      const logStream = await getContainerLogs(containerName);

      // Stream logs to WebSocket
      logStream.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Parse Docker multiplexed stream format
          const data = parseDockerLogChunk(chunk);
          if (data) {
            ws.send(JSON.stringify({ type: 'log', data }));
          }
        }
      });

      logStream.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end' }));
        }
      });

      logStream.on('error', (error: Error) => {
        console.error('Log stream error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
      });

      ws.on('close', () => {
        console.log(`Docker logs WebSocket disconnected for container: ${containerName}`);
        if (
          typeof (logStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy ===
          'function'
        ) {
          (logStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
        }
      });

      ws.on('error', (error) => {
        console.error('Logs WebSocket error:', error);
        if (
          typeof (logStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy ===
          'function'
        ) {
          (logStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
        }
      });
    } catch (error) {
      console.error('Error setting up log stream:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to connect to container logs' }));
      ws.close();
    }
  }
);

// Handle Docker terminal WebSocket connections
wssTerminal.on(
  'connection',
  async (ws: WebSocket, _request: IncomingMessage, containerName: string) => {
    console.log(`Docker terminal WebSocket connected for container: ${containerName}`);

    try {
      const execStream = await execInContainer(containerName);

      // Send container output to WebSocket
      execStream.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: chunk.toString('utf8') }));
        }
      });

      execStream.on('end', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end' }));
          ws.close();
        }
      });

      execStream.on('error', (error: Error) => {
        console.error('Exec stream error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
      });

      // Handle input from WebSocket
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'input' && data.data) {
            execStream.write(data.data);
          } else if (data.type === 'resize' && data.cols && data.rows) {
            // Handle terminal resize if needed
            // Note: Docker exec resize is complex and may need additional implementation
          }
        } catch (error) {
          console.error('Error processing terminal input:', error);
        }
      });

      ws.on('close', () => {
        console.log(`Docker terminal WebSocket disconnected for container: ${containerName}`);
        execStream.end();
      });

      ws.on('error', (error) => {
        console.error('Terminal WebSocket error:', error);
        execStream.end();
      });
    } catch (error) {
      console.error('Error setting up exec stream:', error);
      ws.send(
        JSON.stringify({ type: 'error', message: 'Failed to connect to container terminal' })
      );
      ws.close();
    }
  }
);

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
