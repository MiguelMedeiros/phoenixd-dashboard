import { Router, Response } from 'express';
import Docker from 'dockerode';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';

export const torRouter = Router();

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const TOR_CONTAINER_NAME = 'phoenixd-tor';
// Image name created by docker-compose build
const TOR_IMAGE_NAME = 'phoenixd-dashboard-tor';
const TOR_NETWORK = 'phoenixd-dashboard_phoenixd-network';
const TOR_DATA_VOLUME = 'phoenixd-dashboard_tor_data';
const COMPOSE_PROJECT_NAME = 'phoenixd-dashboard';

// Path to the hidden service hostname file (mounted in backend container)
const HIDDEN_SERVICE_HOSTNAME_PATH = '/tor-data/hidden_service/hostname';

interface TorStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
  onionAddress?: string;
}

/**
 * Get the status of the Tor container
 */
async function getTorContainerStatus(): Promise<TorStatus> {
  try {
    const container = docker.getContainer(TOR_CONTAINER_NAME);
    const info = await container.inspect();

    return {
      enabled: true,
      running: info.State.Running,
      healthy: info.State.Health?.Status === 'healthy',
      containerExists: true,
    };
  } catch (error: unknown) {
    const dockerError = error as { statusCode?: number };
    if (dockerError.statusCode === 404) {
      return {
        enabled: false,
        running: false,
        healthy: false,
        containerExists: false,
      };
    }
    throw error;
  }
}

/**
 * Check if Tor image exists (built by docker-compose)
 */
async function torImageExists(): Promise<boolean> {
  try {
    const images = await docker.listImages({
      filters: { reference: [TOR_IMAGE_NAME] },
    });
    return images.length > 0;
  } catch {
    return false;
  }
}

/**
 * Read the .onion address from the hidden service hostname file
 */
async function getOnionAddress(): Promise<string | null> {
  try {
    if (!existsSync(HIDDEN_SERVICE_HOSTNAME_PATH)) {
      return null;
    }
    const hostname = await readFile(HIDDEN_SERVICE_HOSTNAME_PATH, 'utf-8');
    return hostname.trim();
  } catch (error) {
    console.error('Error reading onion address:', error);
    return null;
  }
}

/**
 * GET /api/tor/status
 * Get the current status of Tor (including Hidden Service)
 */
torRouter.get('/status', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getTorContainerStatus();
    const imageExists = await torImageExists();
    const onionAddress = await getOnionAddress();

    // Get enabled setting from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    res.json({
      enabled: settings?.torEnabled ?? false,
      running: status.running,
      healthy: status.healthy,
      containerExists: status.containerExists,
      imageExists,
      onionAddress,
      // Hidden service URLs (when onion address is available)
      hiddenService: onionAddress
        ? {
            frontend: `http://${onionAddress}`,
            backend: `http://${onionAddress}:4000`,
          }
        : null,
    });
  } catch (error) {
    console.error('Error getting Tor status:', error);
    res.status(500).json({ error: 'Failed to get Tor status' });
  }
});

/**
 * POST /api/tor/enable
 * Start the Tor container
 */
torRouter.post('/enable', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Enabling Tor...');

    // Check if image exists (should be built by docker-compose build)
    if (!(await torImageExists())) {
      return res.status(400).json({
        error: 'Tor image not found. Please run: docker-compose build tor',
      });
    }

    // Check if container already exists
    const status = await getTorContainerStatus();

    if (status.containerExists) {
      if (status.running) {
        // Already running
        await prisma.settings.upsert({
          where: { id: 'singleton' },
          update: { torEnabled: true },
          create: { id: 'singleton', torEnabled: true },
        });

        return res.json({ success: true, message: 'Tor is already running' });
      }

      // Container exists but not running - start it
      console.log('Starting existing Tor container...');
      const container = docker.getContainer(TOR_CONTAINER_NAME);
      await container.start();
    } else {
      // Create and start the container
      console.log('Creating new Tor container...');
      const container = await docker.createContainer({
        name: TOR_CONTAINER_NAME,
        Image: TOR_IMAGE_NAME,
        Labels: {
          'com.docker.compose.project': COMPOSE_PROJECT_NAME,
          'com.docker.compose.service': 'tor',
        },
        HostConfig: {
          NetworkMode: TOR_NETWORK,
          RestartPolicy: { Name: 'unless-stopped' },
          // Mount the tor_data volume to persist hidden service keys
          Binds: [`${TOR_DATA_VOLUME}:/var/lib/tor`],
        },
        Healthcheck: {
          Test: [
            'CMD-SHELL',
            'curl --socks5 localhost:9050 --connect-timeout 10 https://check.torproject.org/api/ip 2>/dev/null | grep -q IsTor || exit 1',
          ],
          Interval: 30000000000, // 30s in nanoseconds
          Timeout: 15000000000, // 15s
          Retries: 3,
          StartPeriod: 60000000000, // 60s
        },
      });

      await container.start();
    }

    // Update settings
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { torEnabled: true },
      create: { id: 'singleton', torEnabled: true },
    });

    console.log('Tor enabled successfully');
    res.json({ success: true, message: 'Tor enabled successfully' });
  } catch (error) {
    console.error('Error enabling Tor:', error);
    res.status(500).json({ error: 'Failed to enable Tor' });
  }
});

/**
 * POST /api/tor/disable
 * Stop and remove the Tor container
 */
torRouter.post('/disable', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Disabling Tor...');

    const status = await getTorContainerStatus();

    if (status.containerExists) {
      const container = docker.getContainer(TOR_CONTAINER_NAME);

      // Stop the container if running
      if (status.running) {
        console.log('Stopping Tor container...');
        await container.stop();
      }

      // Remove the container
      console.log('Removing Tor container...');
      await container.remove();
    }

    // Update settings
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { torEnabled: false },
      create: { id: 'singleton', torEnabled: false },
    });

    console.log('Tor disabled successfully');
    res.json({ success: true, message: 'Tor disabled successfully' });
  } catch (error) {
    console.error('Error disabling Tor:', error);
    res.status(500).json({ error: 'Failed to disable Tor' });
  }
});

/**
 * DELETE /api/tor/image
 * Remove the Tor Docker image
 */
torRouter.delete('/image', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // First ensure container is stopped and removed
    const status = await getTorContainerStatus();
    if (status.containerExists) {
      const container = docker.getContainer(TOR_CONTAINER_NAME);
      if (status.running) {
        await container.stop();
      }
      await container.remove();
    }

    // Try to remove the image
    try {
      const images = await docker.listImages({
        filters: { reference: [TOR_IMAGE_NAME] },
      });
      for (const img of images) {
        await docker.getImage(img.Id).remove({ force: true });
      }
    } catch {
      console.log('No Tor image to remove or already removed');
    }

    // Update settings
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { torEnabled: false },
      create: { id: 'singleton', torEnabled: false },
    });

    res.json({ success: true, message: 'Tor image removed successfully' });
  } catch (error) {
    console.error('Error removing Tor image:', error);
    res.status(500).json({ error: 'Failed to remove Tor image' });
  }
});
