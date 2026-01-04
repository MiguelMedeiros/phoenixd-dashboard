import { Router, Response } from 'express';
import Docker from 'dockerode';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';

export const tailscaleRouter = Router();

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const TAILSCALE_CONTAINER_NAME = 'phoenixd-tailscale';
// Image name created by docker-compose build
const TAILSCALE_IMAGE_NAME = 'phoenixd-dashboard-tailscale';
const TAILSCALE_NETWORK = 'phoenixd-dashboard_phoenixd-network';

interface TailscaleStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
  dnsName?: string;
  hostname?: string;
  hasAuthKey: boolean;
}

/**
 * Get the status of the Tailscale container
 */
async function getTailscaleContainerStatus(): Promise<Omit<TailscaleStatus, 'hasAuthKey'>> {
  try {
    const container = docker.getContainer(TAILSCALE_CONTAINER_NAME);
    const info = await container.inspect();

    // Try to get the DNS name from container logs or environment
    let dnsName: string | undefined;
    let hostname: string | undefined;

    // Get hostname from environment variables
    const envVars = info.Config.Env || [];
    for (const env of envVars) {
      if (env.startsWith('TS_HOSTNAME=')) {
        hostname = env.split('=')[1];
      }
    }

    // Try to get DNS name by executing tailscale status in container
    if (info.State.Running) {
      try {
        const exec = await container.exec({
          Cmd: ['tailscale', 'status', '--json'],
          AttachStdout: true,
          AttachStderr: true,
        });

        const stream = await exec.start({ hijack: true, stdin: false });

        // Collect output
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve());
          setTimeout(resolve, 5000); // Timeout after 5s
        });

        const output = Buffer.concat(chunks).toString();
        // Parse the JSON output (skip Docker stream headers)
        const jsonStart = output.indexOf('{');
        if (jsonStart !== -1) {
          const jsonOutput = output.slice(jsonStart);
          const status = JSON.parse(jsonOutput);
          if (status.Self?.DNSName) {
            dnsName = status.Self.DNSName.replace(/\.$/, ''); // Remove trailing dot
          }
        }
      } catch (e) {
        console.log('Could not get Tailscale DNS name:', e);
      }
    }

    return {
      enabled: true,
      running: info.State.Running,
      healthy: info.State.Health?.Status === 'healthy',
      containerExists: true,
      dnsName,
      hostname,
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
 * Check if Tailscale image exists (built by docker-compose)
 */
async function tailscaleImageExists(): Promise<boolean> {
  try {
    const images = await docker.listImages({
      filters: { reference: [TAILSCALE_IMAGE_NAME] },
    });
    return images.length > 0;
  } catch {
    return false;
  }
}

/**
 * GET /api/tailscale/status
 * Get the current status of Tailscale
 */
tailscaleRouter.get('/status', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const containerStatus = await getTailscaleContainerStatus();
    const imageExists = await tailscaleImageExists();

    // Get settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    res.json({
      enabled: settings?.tailscaleEnabled ?? false,
      running: containerStatus.running,
      healthy: containerStatus.healthy,
      containerExists: containerStatus.containerExists,
      imageExists,
      dnsName: settings?.tailscaleDnsName || containerStatus.dnsName,
      hostname: settings?.tailscaleHostname || containerStatus.hostname,
      hasAuthKey: !!settings?.tailscaleAuthKey,
    });
  } catch (error) {
    console.error('Error getting Tailscale status:', error);
    res.status(500).json({ error: 'Failed to get Tailscale status' });
  }
});

/**
 * PUT /api/tailscale/authkey
 * Save Tailscale auth key
 */
tailscaleRouter.put('/authkey', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { authKey, hostname } = req.body;

    if (!authKey || typeof authKey !== 'string') {
      return res.status(400).json({ error: 'Auth key is required' });
    }

    // Save auth key to database (Note: In production, this should be encrypted)
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        tailscaleAuthKey: authKey,
        tailscaleHostname: hostname || 'phoenixd-dashboard',
      },
      create: {
        id: 'singleton',
        tailscaleAuthKey: authKey,
        tailscaleHostname: hostname || 'phoenixd-dashboard',
      },
    });

    res.json({ success: true, message: 'Auth key saved successfully' });
  } catch (error) {
    console.error('Error saving Tailscale auth key:', error);
    res.status(500).json({ error: 'Failed to save auth key' });
  }
});

/**
 * DELETE /api/tailscale/authkey
 * Remove Tailscale auth key
 */
tailscaleRouter.delete(
  '/authkey',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {
          tailscaleAuthKey: null,
          tailscaleHostname: null,
          tailscaleDnsName: null,
        },
        create: {
          id: 'singleton',
        },
      });

      res.json({ success: true, message: 'Auth key removed successfully' });
    } catch (error) {
      console.error('Error removing Tailscale auth key:', error);
      res.status(500).json({ error: 'Failed to remove auth key' });
    }
  }
);

/**
 * POST /api/tailscale/enable
 * Start the Tailscale container
 */
tailscaleRouter.post('/enable', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Enabling Tailscale...');

    // Check if image exists (should be built by docker-compose build)
    if (!(await tailscaleImageExists())) {
      return res.status(400).json({
        error: 'Tailscale image not found. Please run: docker-compose build tailscale',
      });
    }

    // Get auth key from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings?.tailscaleAuthKey) {
      return res.status(400).json({
        error: 'Tailscale auth key not configured. Please set an auth key first.',
      });
    }

    // Check if container already exists
    const status = await getTailscaleContainerStatus();

    if (status.containerExists) {
      if (status.running) {
        // Already running
        await prisma.settings.update({
          where: { id: 'singleton' },
          data: {
            tailscaleEnabled: true,
            tailscaleDnsName: status.dnsName,
          },
        });

        return res.json({
          success: true,
          message: 'Tailscale is already running',
          dnsName: status.dnsName,
        });
      }

      // Container exists but not running - start it
      console.log('Starting existing Tailscale container...');
      const container = docker.getContainer(TAILSCALE_CONTAINER_NAME);
      await container.start();
    } else {
      // Create and start the container
      console.log('Creating new Tailscale container...');
      const hostname = settings.tailscaleHostname || 'phoenixd-dashboard';

      const container = await docker.createContainer({
        name: TAILSCALE_CONTAINER_NAME,
        Image: TAILSCALE_IMAGE_NAME,
        Env: [`TS_AUTHKEY=${settings.tailscaleAuthKey}`, `TS_HOSTNAME=${hostname}`],
        HostConfig: {
          NetworkMode: TAILSCALE_NETWORK,
          RestartPolicy: { Name: 'unless-stopped' },
          CapAdd: ['NET_ADMIN', 'NET_RAW'],
        },
        Healthcheck: {
          Test: ['CMD-SHELL', 'tailscale status --json | jq -e ".Self.Online == true" || exit 1'],
          Interval: 30000000000, // 30s in nanoseconds
          Timeout: 10000000000, // 10s
          Retries: 3,
          StartPeriod: 60000000000, // 60s
        },
      });

      await container.start();
    }

    // Wait a bit for Tailscale to connect and get DNS name
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get the updated status with DNS name
    const updatedStatus = await getTailscaleContainerStatus();

    // Update settings with DNS name
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: {
        tailscaleEnabled: true,
        tailscaleDnsName: updatedStatus.dnsName,
      },
    });

    console.log('Tailscale enabled successfully');
    res.json({
      success: true,
      message: 'Tailscale enabled successfully',
      dnsName: updatedStatus.dnsName,
    });
  } catch (error) {
    console.error('Error enabling Tailscale:', error);
    res.status(500).json({ error: 'Failed to enable Tailscale' });
  }
});

/**
 * POST /api/tailscale/disable
 * Stop and remove the Tailscale container
 */
tailscaleRouter.post('/disable', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Disabling Tailscale...');

    const status = await getTailscaleContainerStatus();

    if (status.containerExists) {
      const container = docker.getContainer(TAILSCALE_CONTAINER_NAME);

      // Stop the container if running
      if (status.running) {
        console.log('Stopping Tailscale container...');
        await container.stop();
      }

      // Remove the container
      console.log('Removing Tailscale container...');
      await container.remove();
    }

    // Update settings
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        tailscaleEnabled: false,
        tailscaleDnsName: null,
      },
      create: {
        id: 'singleton',
        tailscaleEnabled: false,
      },
    });

    console.log('Tailscale disabled successfully');
    res.json({ success: true, message: 'Tailscale disabled successfully' });
  } catch (error) {
    console.error('Error disabling Tailscale:', error);
    res.status(500).json({ error: 'Failed to disable Tailscale' });
  }
});

/**
 * DELETE /api/tailscale/image
 * Remove the Tailscale Docker image
 */
tailscaleRouter.delete('/image', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // First ensure container is stopped and removed
    const status = await getTailscaleContainerStatus();
    if (status.containerExists) {
      const container = docker.getContainer(TAILSCALE_CONTAINER_NAME);
      if (status.running) {
        await container.stop();
      }
      await container.remove();
    }

    // Try to remove the image
    try {
      const images = await docker.listImages({
        filters: { reference: [TAILSCALE_IMAGE_NAME] },
      });
      for (const img of images) {
        await docker.getImage(img.Id).remove({ force: true });
      }
    } catch {
      console.log('No Tailscale image to remove or already removed');
    }

    // Update settings
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        tailscaleEnabled: false,
        tailscaleDnsName: null,
      },
      create: {
        id: 'singleton',
        tailscaleEnabled: false,
      },
    });

    res.json({ success: true, message: 'Tailscale image removed successfully' });
  } catch (error) {
    console.error('Error removing Tailscale image:', error);
    res.status(500).json({ error: 'Failed to remove Tailscale image' });
  }
});

/**
 * POST /api/tailscale/refresh-dns
 * Refresh the Magic DNS name from the container
 */
tailscaleRouter.post(
  '/refresh-dns',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const status = await getTailscaleContainerStatus();

      if (!status.running) {
        return res.status(400).json({ error: 'Tailscale is not running' });
      }

      if (status.dnsName) {
        await prisma.settings.update({
          where: { id: 'singleton' },
          data: { tailscaleDnsName: status.dnsName },
        });
      }

      res.json({
        success: true,
        dnsName: status.dnsName,
      });
    } catch (error) {
      console.error('Error refreshing Tailscale DNS:', error);
      res.status(500).json({ error: 'Failed to refresh DNS name' });
    }
  }
);
