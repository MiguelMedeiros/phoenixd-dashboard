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
import { contactsRouter } from './routes/contacts.js';
import { categoriesRouter } from './routes/categories.js';
import { paymentMetadataRouter } from './routes/payment-metadata.js';
import { recurringPaymentsRouter } from './routes/recurring-payments.js';
import { phoenixdConfigRouter } from './routes/phoenixd-config.js';
import {
  phoenixdConnectionsRouter,
  initializeDockerConnection,
} from './routes/phoenixd-connections.js';
import { appsRouter } from './routes/apps.js';
import { appsApiRouter } from './routes/apps-api.js';
import { setupRouter } from './routes/setup.js';
import { PhoenixdService } from './services/phoenixd.js';
import { startRecurringPaymentScheduler } from './services/recurring-scheduler.js';
import { cleanupExpiredSessions, validateSessionFromCookie } from './middleware/auth.js';
import { dispatchPaymentReceived, cleanupOldWebhookLogs } from './services/app-webhooks.js';
import { AppDockerService } from './services/app-docker.js';
import crypto from 'crypto';

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

      // Allow Tauri desktop app origins
      if (origin.startsWith('tauri://') || origin.startsWith('http://tauri.')) {
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
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    desktopMode: process.env.DESKTOP_MODE === 'true',
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/phoenixd', phoenixdRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/payments/metadata', paymentMetadataRouter);
app.use('/api/node', nodeRouter);
app.use('/api/lnurl', lnurlRouter);
app.use('/api/tor', torRouter);
app.use('/api/tailscale', tailscaleRouter);
app.use('/api/cloudflared', cloudflaredRouter);
app.use('/api/config', configRouter);
app.use('/api/docker', dockerRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/recurring-payments', recurringPaymentsRouter);
app.use('/api/phoenixd', phoenixdConfigRouter); // Mount phoenixd config routes (they have their own paths like /config)
app.use('/api/phoenixd-connections', phoenixdConnectionsRouter);
app.use('/api/apps', appsRouter); // Apps management
app.use('/api/apps-gateway', appsApiRouter); // API gateway for apps to call backend
app.use('/api/setup', setupRouter); // Setup wizard

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

// Phoenixd WebSocket connection state
let phoenixdWs: WebSocket | null = null;
let phoenixdWsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = true;

// Connect to phoenixd WebSocket for payment notifications
async function connectPhoenixdWebSocket() {
  // Clear any pending reconnect timeout
  if (phoenixdWsReconnectTimeout) {
    clearTimeout(phoenixdWsReconnectTimeout);
    phoenixdWsReconnectTimeout = null;
  }

  // Close existing connection if any
  if (phoenixdWs) {
    shouldReconnect = false; // Prevent auto-reconnect during manual close
    phoenixdWs.close();
    phoenixdWs = null;
  }
  shouldReconnect = true;

  // Get current config from PhoenixdService
  const config = phoenixd.getFullConfig();
  const phoenixdWsUrl = config.url.replace('http', 'ws') + '/websocket';
  const password = config.password;

  console.log(
    `Connecting to phoenixd WebSocket at ${phoenixdWsUrl} (${config.isExternal ? 'external' : 'docker'})...`
  );

  try {
    phoenixdWs = new WebSocket(phoenixdWsUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`:${password}`).toString('base64'),
      },
    });

    phoenixdWs.on('open', () => {
      console.log('Connected to phoenixd WebSocket');
    });

    phoenixdWs.on('message', async (data) => {
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
                rawData: JSON.stringify(event),
              },
            });
          } catch (dbError) {
            console.error('Error saving payment to database:', dbError);
          }

          // Dispatch webhook to subscribed apps (fire and forget)
          dispatchPaymentReceived({
            paymentHash: event.paymentHash || '',
            amountSat: event.amountSat || 0,
            description: event.description,
            externalId: event.externalId,
            receivedAt: Date.now(),
            payerKey: event.payerKey,
            payerNote: event.payerNote,
          }).catch((webhookError) => {
            console.error('Error dispatching payment webhook:', webhookError);
          });
        }
      } catch (error) {
        console.error('Error processing phoenixd event:', error);
      }
    });

    phoenixdWs.on('close', () => {
      console.log('Disconnected from phoenixd WebSocket');
      phoenixdWs = null;
      if (shouldReconnect) {
        console.log('Reconnecting in 5s...');
        phoenixdWsReconnectTimeout = setTimeout(connectPhoenixdWebSocket, 5000);
      }
    });

    phoenixdWs.on('error', (error) => {
      console.error('Phoenixd WebSocket error:', error);
    });
  } catch (error) {
    console.error('Failed to connect to phoenixd WebSocket:', error);
    if (shouldReconnect) {
      phoenixdWsReconnectTimeout = setTimeout(connectPhoenixdWebSocket, 5000);
    }
  }
}

// Force reconnect the phoenixd WebSocket (called when config changes)
export function reconnectPhoenixdWebSocket() {
  console.log('Forcing phoenixd WebSocket reconnection...');
  connectPhoenixdWebSocket();
}

/**
 * Install default/featured apps from the marketplace
 * These apps come pre-installed for convenience
 */
async function installDefaultApps() {
  const defaultApps = [
    {
      name: 'Donations Page',
      slug: 'donations',
      description:
        'Beautiful donation page to accept Lightning payments with customizable branding',
      icon: '💜',
      sourceType: 'docker_image',
      // Use local image for development, will be published to ghcr.io for production
      sourceUrl: 'phoenixd-donations:latest',
      webhookEvents: ['payment_received'],
      apiPermissions: ['write:invoices', 'read:node'],
      envVars: {
        DONATIONS_TITLE: 'Support Our Project',
        DONATIONS_SUBTITLE: 'Your contribution helps us keep building amazing things',
        DONATIONS_THEME: 'dark',
        DONATIONS_AMOUNTS: '1000,5000,10000,50000',
      },
    },
  ];

  for (const appConfig of defaultApps) {
    try {
      // Check if app already exists
      const existing = await prisma.app.findUnique({
        where: { slug: appConfig.slug },
      });

      if (existing) {
        console.log(`Default app "${appConfig.name}" already installed`);
        continue;
      }

      // Create the app
      const app = await prisma.app.create({
        data: {
          name: appConfig.name,
          slug: appConfig.slug,
          description: appConfig.description,
          icon: appConfig.icon,
          sourceType: appConfig.sourceType,
          sourceUrl: appConfig.sourceUrl,
          version: 'latest',
          containerName: `phoenixd-app-${appConfig.slug}`,
          containerStatus: 'stopped',
          internalPort: 3000,
          envVars: JSON.stringify(appConfig.envVars),
          webhookEvents: JSON.stringify(appConfig.webhookEvents),
          webhookSecret: crypto.randomBytes(32).toString('hex'),
          webhookPath: '/webhook',
          apiKey: `phxapp_${crypto.randomBytes(32).toString('hex')}`,
          apiPermissions: JSON.stringify(appConfig.apiPermissions),
          isEnabled: true,
          healthStatus: 'unknown',
        },
      });

      console.log(`✅ Default app "${appConfig.name}" installed (id: ${app.id})`);
    } catch (error) {
      console.error(`Failed to install default app "${appConfig.name}":`, error);
    }
  }
}

// Start server
const PORT = process.env.PORT || 4000;

server.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);

  // Initialize phoenixd connections and connect to WebSocket
  await initializeDockerConnection();
  setTimeout(connectPhoenixdWebSocket, 3000);

  // Install default apps (Donations, etc.)
  await installDefaultApps();

  // Cleanup expired sessions every hour
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
  // Also run cleanup on startup
  cleanupExpiredSessions();

  // Start recurring payments scheduler (check every minute)
  startRecurringPaymentScheduler(60000);

  // Apps: Health check every 5 minutes
  const appDockerService = new AppDockerService();
  setInterval(
    () => {
      appDockerService.updateAllHealthStatuses().catch((error) => {
        console.error('Error updating app health statuses:', error);
      });
    },
    5 * 60 * 1000
  );

  // Apps: Cleanup old webhook logs daily
  setInterval(
    () => {
      cleanupOldWebhookLogs().catch((error) => {
        console.error('Error cleaning up webhook logs:', error);
      });
    },
    24 * 60 * 60 * 1000
  );
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});
