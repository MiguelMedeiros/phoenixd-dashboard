import { Router, Response } from 'express';
import Docker from 'dockerode';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { prisma, broadcastServiceEvent } from '../index.js';

export const cloudflaredRouter = Router();

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const CLOUDFLARED_CONTAINER_NAME = 'phoenixd-cloudflared';
// Official cloudflared image from Cloudflare
const CLOUDFLARED_IMAGE_NAME = 'cloudflare/cloudflared:latest';
const CLOUDFLARED_NETWORK = 'phoenixd-dashboard_phoenixd-network';
const COMPOSE_PROJECT_NAME = 'phoenixd-dashboard';

interface IngressRule {
  hostname: string;
  service: string;
  path?: string;
}

interface CloudflaredStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
  hasToken: boolean;
  ingress: IngressRule[];
}

/**
 * Get the status of the Cloudflared container
 */
async function getCloudflaredContainerStatus(): Promise<
  Omit<CloudflaredStatus, 'hasToken' | 'ingress'>
> {
  try {
    const container = docker.getContainer(CLOUDFLARED_CONTAINER_NAME);
    const info = await container.inspect();

    // If there's a health check, use its status; otherwise, consider running as healthy
    // since cloudflared logs to stderr even when connected successfully
    const hasHealthCheck = !!info.State.Health;
    const isHealthy = hasHealthCheck
      ? info.State.Health?.Status === 'healthy'
      : info.State.Running && !info.State.Restarting;

    return {
      enabled: true,
      running: info.State.Running,
      healthy: isHealthy,
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
 * Check if Cloudflared image exists (or pull it)
 */
async function cloudflaredImageExists(): Promise<boolean> {
  try {
    const images = await docker.listImages({
      filters: { reference: ['cloudflare/cloudflared'] },
    });
    return images.length > 0;
  } catch {
    return false;
  }
}

/**
 * Pull the cloudflared image if it doesn't exist
 */
async function pullCloudflaredImage(): Promise<void> {
  console.log('Pulling cloudflared image...');
  return new Promise((resolve, reject) => {
    docker.pull(CLOUDFLARED_IMAGE_NAME, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        reject(err);
        return;
      }
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          console.log('Cloudflared image pulled successfully');
          resolve();
        }
      });
    });
  });
}

/**
 * GET /api/cloudflared/status
 * Get the current status of Cloudflared
 */
cloudflaredRouter.get('/status', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const containerStatus = await getCloudflaredContainerStatus();
    const imageExists = await cloudflaredImageExists();

    // Get settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const ingress = (settings?.cloudflaredIngress as IngressRule[] | null) || [];

    res.json({
      enabled: settings?.cloudflaredEnabled ?? false,
      running: containerStatus.running,
      healthy: containerStatus.healthy,
      containerExists: containerStatus.containerExists,
      imageExists,
      hasToken: !!settings?.cloudflaredToken,
      ingress,
    });
  } catch (error) {
    console.error('Error getting Cloudflared status:', error);
    res.status(500).json({ error: 'Failed to get Cloudflared status' });
  }
});

/**
 * PUT /api/cloudflared/token
 * Save Cloudflared tunnel token
 */
cloudflaredRouter.put('/token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Save token to database
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        cloudflaredToken: token,
      },
      create: {
        id: 'singleton',
        cloudflaredToken: token,
      },
    });

    res.json({ success: true, message: 'Token saved successfully' });
  } catch (error) {
    console.error('Error saving Cloudflared token:', error);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

/**
 * DELETE /api/cloudflared/token
 * Remove Cloudflared tunnel token
 */
cloudflaredRouter.delete(
  '/token',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {
          cloudflaredToken: null,
        },
        create: {
          id: 'singleton',
        },
      });

      res.json({ success: true, message: 'Token removed successfully' });
    } catch (error) {
      console.error('Error removing Cloudflared token:', error);
      res.status(500).json({ error: 'Failed to remove token' });
    }
  }
);

/**
 * PUT /api/cloudflared/ingress
 * Configure ingress rules for the tunnel
 */
cloudflaredRouter.put('/ingress', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ingress } = req.body;

    if (!Array.isArray(ingress)) {
      return res.status(400).json({ error: 'Ingress must be an array' });
    }

    // Validate ingress rules
    for (const rule of ingress) {
      if (!rule.hostname || !rule.service) {
        return res.status(400).json({ error: 'Each ingress rule must have hostname and service' });
      }
    }

    // Save ingress rules to database
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        cloudflaredIngress: ingress,
      },
      create: {
        id: 'singleton',
        cloudflaredIngress: ingress,
      },
    });

    res.json({ success: true, message: 'Ingress rules saved successfully', ingress });
  } catch (error) {
    console.error('Error saving Cloudflared ingress rules:', error);
    res.status(500).json({ error: 'Failed to save ingress rules' });
  }
});

/**
 * POST /api/cloudflared/enable
 * Start the Cloudflared container
 */
cloudflaredRouter.post(
  '/enable',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('Enabling Cloudflared...');

      // Check if image exists, pull if not
      if (!(await cloudflaredImageExists())) {
        try {
          await pullCloudflaredImage();
        } catch (pullError) {
          console.error('Failed to pull cloudflared image:', pullError);
          return res.status(500).json({
            error: 'Failed to pull cloudflared image. Check your internet connection.',
          });
        }
      }

      // Get token from database
      const settings = await prisma.settings.findUnique({
        where: { id: 'singleton' },
      });

      if (!settings?.cloudflaredToken) {
        return res.status(400).json({
          error: 'Cloudflared token not configured. Please set a token first.',
        });
      }

      // Check if container already exists
      const status = await getCloudflaredContainerStatus();

      if (status.containerExists) {
        if (status.running) {
          // Already running
          await prisma.settings.update({
            where: { id: 'singleton' },
            data: {
              cloudflaredEnabled: true,
            },
          });

          return res.json({
            success: true,
            message: 'Cloudflared is already running',
          });
        }

        // Container exists but not running - remove and recreate with new token
        console.log('Removing existing Cloudflared container...');
        const container = docker.getContainer(CLOUDFLARED_CONTAINER_NAME);
        await container.remove({ force: true });
      }

      // Create and start the container
      console.log('Creating new Cloudflared container...');

      const container = await docker.createContainer({
        name: CLOUDFLARED_CONTAINER_NAME,
        Image: CLOUDFLARED_IMAGE_NAME,
        Cmd: ['tunnel', '--no-autoupdate', 'run', '--token', settings.cloudflaredToken],
        Labels: {
          'com.docker.compose.project': COMPOSE_PROJECT_NAME,
          'com.docker.compose.service': 'cloudflared',
        },
        HostConfig: {
          NetworkMode: CLOUDFLARED_NETWORK,
          RestartPolicy: { Name: 'unless-stopped' },
        },
      });

      await container.start();

      // Update settings
      await prisma.settings.update({
        where: { id: 'singleton' },
        data: {
          cloudflaredEnabled: true,
        },
      });

      console.log('Cloudflared enabled successfully');

      // Broadcast connection event
      broadcastServiceEvent({
        type: 'cloudflared:connected',
        message: 'Cloudflare Tunnel connected',
      });

      res.json({
        success: true,
        message: 'Cloudflared enabled successfully',
      });
    } catch (error) {
      console.error('Error enabling Cloudflared:', error);

      // Broadcast error event
      broadcastServiceEvent({
        type: 'cloudflared:error',
        message: 'Failed to enable Cloudflare Tunnel',
      });

      res.status(500).json({ error: 'Failed to enable Cloudflared' });
    }
  }
);

/**
 * POST /api/cloudflared/disable
 * Stop and remove the Cloudflared container
 */
cloudflaredRouter.post(
  '/disable',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('Disabling Cloudflared...');

      const status = await getCloudflaredContainerStatus();

      if (status.containerExists) {
        const container = docker.getContainer(CLOUDFLARED_CONTAINER_NAME);

        // Stop the container if running
        if (status.running) {
          console.log('Stopping Cloudflared container...');
          await container.stop();
        }

        // Remove the container
        console.log('Removing Cloudflared container...');
        await container.remove();
      }

      // Update settings
      await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {
          cloudflaredEnabled: false,
        },
        create: {
          id: 'singleton',
          cloudflaredEnabled: false,
        },
      });

      console.log('Cloudflared disabled successfully');

      // Broadcast disconnection event
      broadcastServiceEvent({
        type: 'cloudflared:disconnected',
        message: 'Cloudflare Tunnel disconnected',
      });

      res.json({ success: true, message: 'Cloudflared disabled successfully' });
    } catch (error) {
      console.error('Error disabling Cloudflared:', error);
      res.status(500).json({ error: 'Failed to disable Cloudflared' });
    }
  }
);

/**
 * GET /api/cloudflared/logs
 * Get recent logs from the Cloudflared container
 */
cloudflaredRouter.get('/logs', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getCloudflaredContainerStatus();

    if (!status.containerExists) {
      return res.status(400).json({ error: 'Cloudflared container does not exist' });
    }

    const container = docker.getContainer(CLOUDFLARED_CONTAINER_NAME);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      timestamps: true,
    });

    // Convert buffer to string and clean up Docker stream headers
    const logString = logs.toString('utf-8');

    res.json({ logs: logString });
  } catch (error) {
    console.error('Error getting Cloudflared logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

/**
 * DELETE /api/cloudflared/image
 * Remove the Cloudflared Docker image
 */
cloudflaredRouter.delete(
  '/image',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      // First ensure container is stopped and removed
      const status = await getCloudflaredContainerStatus();
      if (status.containerExists) {
        const container = docker.getContainer(CLOUDFLARED_CONTAINER_NAME);
        if (status.running) {
          await container.stop();
        }
        await container.remove();
      }

      // Try to remove the image
      try {
        const images = await docker.listImages({
          filters: { reference: [CLOUDFLARED_IMAGE_NAME] },
        });
        for (const img of images) {
          await docker.getImage(img.Id).remove({ force: true });
        }
      } catch {
        console.log('No Cloudflared image to remove or already removed');
      }

      // Update settings
      await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {
          cloudflaredEnabled: false,
        },
        create: {
          id: 'singleton',
          cloudflaredEnabled: false,
        },
      });

      res.json({ success: true, message: 'Cloudflared image removed successfully' });
    } catch (error) {
      console.error('Error removing Cloudflared image:', error);
      res.status(500).json({ error: 'Failed to remove Cloudflared image' });
    }
  }
);
