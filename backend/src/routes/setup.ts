import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma, phoenixd, reconnectPhoenixdWebSocket } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppDockerService } from '../services/app-docker.js';

const appDocker = new AppDockerService();

const execAsync = promisify(exec);

export const setupRouter = Router();

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Containers that are essential for the wizard (never stop these) - for documentation
const _ESSENTIAL_CONTAINERS = ['phoenixd-postgres', 'phoenixd-backend', 'phoenixd-frontend'];

// All optional containers that can be managed by the wizard
const OPTIONAL_CONTAINERS = [
  'phoenixd', // Local phoenixd node
  'phoenixd-tor',
  'phoenixd-tailscale',
  'phoenixd-cloudflared',
  'phoenixd-app-donations', // Donations app
];

// Prefix for app containers (to find dynamically installed apps)
const APP_CONTAINER_PREFIX = 'phoenixd-app-';

// Map container names to their docker-compose service names and profiles
// Note: App containers (phoenixd-app-*) are not in docker-compose.yml - they are managed by AppDockerService
const CONTAINER_SERVICE_MAP: Record<string, { service: string; profile?: string }> = {
  phoenixd: { service: 'phoenixd' },
  'phoenixd-tor': { service: 'tor', profile: 'tor' },
  'phoenixd-tailscale': { service: 'tailscale', profile: 'tailscale' },
  'phoenixd-cloudflared': { service: 'cloudflared', profile: 'cloudflared' },
};

/**
 * Check if a container exists
 */
async function containerExists(name: string): Promise<boolean> {
  try {
    const container = docker.getContainer(name);
    await container.inspect();
    return true;
  } catch (error: unknown) {
    const dockerError = error as { statusCode?: number };
    if (dockerError.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Stop a container by name (ignores errors if container doesn't exist or is already stopped)
 */
async function stopContainer(name: string): Promise<boolean> {
  try {
    const container = docker.getContainer(name);
    await container.stop();
    console.log(`Stopped container: ${name}`);
    return true;
  } catch (error: unknown) {
    const dockerError = error as { statusCode?: number; reason?: string };
    // 304 = already stopped, 404 = not found - both are fine
    if (dockerError.statusCode === 304 || dockerError.statusCode === 404) {
      return true;
    }
    console.error(`Failed to stop container ${name}:`, error);
    return false;
  }
}

/**
 * Start or create a container by name
 * If the container exists, it starts it
 * If it doesn't exist and has a profile, it creates it using docker compose
 */
async function startContainer(name: string): Promise<boolean> {
  try {
    // First, check if container exists
    const exists = await containerExists(name);

    if (exists) {
      // Container exists, try to start it
      try {
        const container = docker.getContainer(name);
        await container.start();
        console.log(`Started existing container: ${name}`);
        return true;
      } catch (error: unknown) {
        const dockerError = error as { statusCode?: number };
        // 304 = already running - that's fine
        if (dockerError.statusCode === 304) {
          console.log(`Container already running: ${name}`);
          return true;
        }
        throw error;
      }
    }

    // Container doesn't exist, need to create it with docker compose
    const serviceInfo = CONTAINER_SERVICE_MAP[name];
    if (!serviceInfo) {
      console.error(`Unknown container: ${name}, cannot create it`);
      return false;
    }

    console.log(`Container ${name} doesn't exist, creating with docker compose...`);

    // Build the docker compose command with project name to match existing containers
    let cmd = 'docker compose -p phoenixd-dashboard';
    if (serviceInfo.profile) {
      cmd += ` --profile ${serviceInfo.profile}`;
    }
    cmd += ` up -d ${serviceInfo.service}`;

    console.log(`Running: ${cmd}`);

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: '/project', // Project files are mounted here from host
      env: { ...process.env },
    });

    if (stdout) console.log(`docker compose stdout: ${stdout}`);
    if (stderr) console.log(`docker compose stderr: ${stderr}`);

    console.log(`Created and started container: ${name}`);
    return true;
  } catch (error) {
    console.error(`Failed to start/create container ${name}:`, error);
    return false;
  }
}

/**
 * Get all running app containers dynamically
 */
async function getAppContainers(): Promise<string[]> {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers
      .filter((container) => {
        const names = container.Names || [];
        return names.some((name) => {
          const cleanName = name.replace(/^\//, '');
          return cleanName.startsWith(APP_CONTAINER_PREFIX);
        });
      })
      .map((container) => (container.Names[0] || '').replace(/^\//, ''));
  } catch (error) {
    console.error('Error listing app containers:', error);
    return [];
  }
}

/**
 * Stop all optional containers (factory reset mode)
 */
async function stopOptionalContainers(): Promise<void> {
  console.log('Stopping optional containers for wizard reset...');

  // Get dynamically installed app containers
  const appContainers = await getAppContainers();
  console.log('Found app containers:', appContainers);

  // Combine static list with dynamically found app containers
  const allContainersToStop = [...new Set([...OPTIONAL_CONTAINERS, ...appContainers])];

  await Promise.all(allContainersToStop.map((name) => stopContainer(name)));
}

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cookie options for security
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: SESSION_DURATION_MS,
  path: '/',
};

// Valid setup profiles
const VALID_PROFILES = ['minimal', 'full', 'custom'];

// Valid locales (must match frontend i18n/routing.ts)
const VALID_LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'zh', 'ko', 'ja', 'ru', 'ar', 'hi'];

// Valid lock screen backgrounds (must match frontend)
const VALID_LOCK_SCREEN_BGS = [
  'lightning',
  'thunder-flash',
  'storm-clouds',
  'electric-storm',
  'night-lightning',
  'sky-thunder',
];

export interface SetupConfig {
  profile: 'minimal' | 'full' | 'custom';
  password: string;
  locale: string;
  theme: string;
  lockScreenBg?: string;
  phoenixd: {
    type: 'docker' | 'external';
    connections?: Array<{
      name: string;
      url: string;
      password: string;
    }>;
  };
  network: {
    tailscale?: {
      enabled: boolean;
      authKey?: string;
      hostname?: string;
    };
    cloudflared?: {
      enabled: boolean;
      token?: string;
    };
    tor?: {
      enabled: boolean;
    };
  };
  apps: {
    donations?: boolean;
  };
}

/**
 * GET /api/setup/status
 * Check if setup has been completed (public, no auth required)
 */
setupRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    res.json({
      setupCompleted: settings?.setupCompleted ?? false,
      setupProfile: settings?.setupProfile || null,
      defaultLocale: settings?.defaultLocale || 'en',
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

/**
 * POST /api/setup/complete
 * Complete the setup wizard with all configuration
 */
setupRouter.post('/complete', async (req: Request, res: Response) => {
  try {
    const config: SetupConfig = req.body;

    // Validate required fields
    if (!config.profile || !VALID_PROFILES.includes(config.profile)) {
      return res.status(400).json({ error: 'Invalid profile' });
    }

    if (!config.password || typeof config.password !== 'string' || config.password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Check if setup was already completed
    const existingSettings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (existingSettings?.setupCompleted) {
      return res.status(400).json({
        error: 'Setup already completed. Use reset endpoint to start over.',
      });
    }

    // Validate locale
    const locale = config.locale && VALID_LOCALES.includes(config.locale) ? config.locale : 'en';

    // Validate lock screen background
    const lockScreenBg =
      config.lockScreenBg && VALID_LOCK_SCREEN_BGS.includes(config.lockScreenBg)
        ? config.lockScreenBg
        : 'electric-storm';

    // Hash password
    const passwordHash = await bcrypt.hash(config.password, SALT_ROUNDS);

    // Start a transaction to apply all settings
    await prisma.$transaction(async (tx) => {
      // Update settings
      await tx.settings.upsert({
        where: { id: 'singleton' },
        update: {
          passwordHash,
          setupCompleted: true,
          setupProfile: config.profile,
          defaultLocale: locale,
          lockScreenBg,
        },
        create: {
          id: 'singleton',
          passwordHash,
          setupCompleted: true,
          setupProfile: config.profile,
          defaultLocale: locale,
          lockScreenBg,
        },
      });

      // Handle phoenixd connections
      if (config.phoenixd?.type === 'external' && config.phoenixd.connections?.length) {
        // Add external connections
        for (const conn of config.phoenixd.connections) {
          // Validate URL
          try {
            new URL(conn.url);
          } catch {
            throw new Error(`Invalid URL for connection ${conn.name}`);
          }

          // Test connection before saving
          try {
            const testResult = await phoenixd.testConnection(conn.url, conn.password || '');

            // Create connection
            await tx.phoenixdConnection.create({
              data: {
                name: conn.name,
                url: conn.url,
                password: conn.password || null,
                isDocker: false,
                isActive: false,
                nodeId: testResult.nodeId,
                chain: testResult.chain,
                lastConnectedAt: new Date(),
              },
            });
          } catch (err) {
            console.error(`Failed to test connection ${conn.name}:`, err);
            // Continue without failing - user can fix later
          }
        }

        // Deactivate Docker connection if using external
        await tx.phoenixdConnection.updateMany({
          where: { isDocker: true },
          data: { isActive: false },
        });

        // Activate first external connection
        const firstExternal = await tx.phoenixdConnection.findFirst({
          where: { isDocker: false },
          orderBy: { createdAt: 'asc' },
        });

        if (firstExternal) {
          await tx.phoenixdConnection.update({
            where: { id: firstExternal.id },
            data: { isActive: true },
          });
        }
      } else {
        // Use Docker connection - ensure it's active
        await tx.phoenixdConnection.updateMany({
          where: { isDocker: true },
          data: { isActive: true },
        });
      }

      // Handle network services configuration
      const networkUpdate: {
        tailscaleAuthKey?: string | null;
        tailscaleHostname?: string | null;
        cloudflaredToken?: string | null;
      } = {};

      if (config.network?.tailscale?.enabled && config.network.tailscale.authKey) {
        networkUpdate.tailscaleAuthKey = config.network.tailscale.authKey;
        networkUpdate.tailscaleHostname = config.network.tailscale.hostname || 'phoenixd-dashboard';
      }

      if (config.network?.cloudflared?.enabled && config.network.cloudflared.token) {
        networkUpdate.cloudflaredToken = config.network.cloudflared.token;
      }

      if (Object.keys(networkUpdate).length > 0) {
        await tx.settings.update({
          where: { id: 'singleton' },
          data: networkUpdate,
        });
      }

      // Handle apps pre-installation
      // For now, apps are already installed by default, but we can enable/disable them
      if (config.apps?.donations === false) {
        // Disable donations app if user doesn't want it
        await tx.app.updateMany({
          where: { slug: 'donations' },
          data: { isEnabled: false },
        });
      }
    });

    // Create session for the new user
    const session = await prisma.session.create({
      data: {
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      },
    });

    // Start containers based on user configuration
    console.log('Starting containers based on wizard configuration...');

    // Start phoenixd container if user chose Docker
    if (config.phoenixd?.type === 'docker') {
      console.log('Starting local Docker phoenixd container...');
      await startContainer('phoenixd');
    }

    // Start network services if enabled
    if (config.network?.tailscale?.enabled) {
      console.log('Starting Tailscale container...');
      await startContainer('phoenixd-tailscale');
    }

    if (config.network?.cloudflared?.enabled) {
      console.log('Starting Cloudflared container...');
      await startContainer('phoenixd-cloudflared');
    }

    if (config.network?.tor?.enabled) {
      console.log('Starting Tor container...');
      await startContainer('phoenixd-tor');
    }

    // Start app containers if enabled
    if (config.apps?.donations) {
      console.log('Starting Donations app container...');
      // Use appDocker service for apps since they are not in docker-compose.yml
      const donationsApp = await prisma.app.findFirst({
        where: { slug: 'donations' },
      });
      if (donationsApp) {
        try {
          await appDocker.startApp(donationsApp);
        } catch (err) {
          console.error('Failed to start donations app:', err);
        }
      }
    }

    // Reconnect phoenixd WebSocket with new config
    const activeConnection = await prisma.phoenixdConnection.findFirst({
      where: { isActive: true },
    });

    if (activeConnection) {
      phoenixd.updateConfig(
        activeConnection.url,
        activeConnection.password || '',
        !activeConnection.isDocker
      );

      // Wait a bit for phoenixd container to be ready before connecting
      if (config.phoenixd?.type === 'docker') {
        console.log('Waiting for phoenixd container to be ready...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      reconnectPhoenixdWebSocket();
    }

    // Set session cookie
    res.cookie('session', session.id, cookieOptions);
    res.json({
      success: true,
      message: 'Setup completed successfully',
      locale,
    });
  } catch (error) {
    console.error('Error completing setup:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to complete setup',
    });
  }
});

/**
 * Reset options interface
 */
interface ResetOptions {
  keepContacts?: boolean;
  keepRecurring?: boolean;
  keepPhoenixdConnections?: boolean;
}

/**
 * POST /api/setup/reset
 * Reset setup to start wizard again (requires auth + password verification)
 * This performs a "factory reset" - stops all non-essential containers
 * Options allow keeping certain data during reset
 */
setupRouter.post('/reset', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, options } = req.body as { password: string; options?: ResetOptions };

    // Get current settings
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings?.passwordHash) {
      return res.status(400).json({ error: 'No password configured' });
    }

    // Verify password
    if (!password) {
      return res.status(400).json({ error: 'Password is required to reset setup' });
    }

    const valid = await bcrypt.compare(password, settings.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Parse options with defaults (keep nothing by default)
    const keepContacts = options?.keepContacts ?? false;
    const keepRecurring = options?.keepRecurring ?? false;
    const keepPhoenixdConnections = options?.keepPhoenixdConnections ?? false;

    // Stop all optional containers (factory reset mode)
    await stopOptionalContainers();

    // Reset setup status (but keep password hash for verification)
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: {
        setupCompleted: false,
        setupProfile: null,
        // Clear network service configs
        tailscaleAuthKey: null,
        tailscaleHostname: null,
        cloudflaredToken: null,
      },
    });

    // Handle phoenixd connections
    if (keepPhoenixdConnections) {
      // Just deactivate all connections, keep the data
      await prisma.phoenixdConnection.updateMany({
        data: { isActive: false },
      });
      console.log('Kept phoenixd connections (deactivated)');
    } else {
      // Delete all non-Docker connections
      await prisma.phoenixdConnection.deleteMany({
        where: { isDocker: false },
      });
      // Deactivate Docker connection
      await prisma.phoenixdConnection.updateMany({
        where: { isDocker: true },
        data: { isActive: false },
      });
      console.log('Deleted external phoenixd connections');
    }

    // Handle contacts
    if (!keepContacts) {
      await prisma.contact.deleteMany({});
      console.log('Deleted all contacts');
    } else {
      console.log('Kept contacts');
    }

    // Handle recurring payments
    if (!keepRecurring) {
      // Delete executions first (foreign key)
      await prisma.recurringPaymentExecution.deleteMany({});
      await prisma.recurringPayment.deleteMany({});
      console.log('Deleted all recurring payments');
    } else {
      console.log('Kept recurring payments');
    }

    // Clear all sessions to force re-login after wizard
    await prisma.session.deleteMany({});

    res.clearCookie('session', { path: '/' });
    res.json({
      success: true,
      message: 'Setup has been reset. All optional services have been stopped.',
      keptData: {
        contacts: keepContacts,
        recurring: keepRecurring,
        phoenixdConnections: keepPhoenixdConnections,
      },
    });
  } catch (error) {
    console.error('Error resetting setup:', error);
    res.status(500).json({ error: 'Failed to reset setup' });
  }
});

/**
 * GET /api/setup/available-apps
 * Get list of available apps that can be pre-installed
 */
setupRouter.get('/available-apps', async (_req: Request, res: Response) => {
  try {
    // For now, return a static list. In the future, this could query a marketplace.
    const availableApps = [
      {
        slug: 'donations',
        name: 'Donations Page',
        description:
          'Beautiful donation page to accept Lightning payments with customizable branding',
        icon: '💜',
        recommended: true,
      },
    ];

    res.json(availableApps);
  } catch (error) {
    console.error('Error fetching available apps:', error);
    res.status(500).json({ error: 'Failed to fetch available apps' });
  }
});

/**
 * GET /api/setup/containers-status
 * Get status of all optional containers (for wizard UI feedback)
 */
setupRouter.get('/containers-status', async (_req: Request, res: Response) => {
  try {
    const statuses: Record<string, { exists: boolean; running: boolean; state: string }> = {};

    // Get dynamically installed app containers
    const appContainers = await getAppContainers();

    // Combine static list with dynamically found app containers
    const allContainers = [...new Set([...OPTIONAL_CONTAINERS, ...appContainers])];

    for (const name of allContainers) {
      try {
        const container = docker.getContainer(name);
        const info = await container.inspect();
        statuses[name] = {
          exists: true,
          running: info.State.Running,
          state: info.State.Status,
        };
      } catch (error: unknown) {
        const dockerError = error as { statusCode?: number };
        if (dockerError.statusCode === 404) {
          statuses[name] = {
            exists: false,
            running: false,
            state: 'not_found',
          };
        } else {
          statuses[name] = {
            exists: false,
            running: false,
            state: 'error',
          };
        }
      }
    }

    res.json(statuses);
  } catch (error) {
    console.error('Error getting containers status:', error);
    res.status(500).json({ error: 'Failed to get containers status' });
  }
});

/**
 * POST /api/setup/test-phoenixd
 * Test a phoenixd connection without saving (for wizard validation)
 */
setupRouter.post('/test-phoenixd', async (req: Request, res: Response) => {
  try {
    const { url, password } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Test connection
    try {
      const testResult = await phoenixd.testConnection(url, password || '');
      res.json({
        success: true,
        nodeId: testResult.nodeId,
        chain: testResult.chain,
        version: testResult.version,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      res.status(400).json({ success: false, error: errorMessage });
    }
  } catch (error) {
    console.error('Error testing phoenixd connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});
