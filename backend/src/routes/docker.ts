import { Router, Response, Request } from 'express';
import Docker from 'dockerode';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const dockerRouter = Router();

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Container name prefix for project containers
const PROJECT_PREFIX = 'phoenixd';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
}

/**
 * Get all project containers
 */
async function getProjectContainers(): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({ all: true });

    // Filter containers that belong to this project
    const projectContainers = containers.filter((container) => {
      const names = container.Names || [];
      return names.some((name) => name.includes(PROJECT_PREFIX));
    });

    return projectContainers.map((container) => ({
      id: container.Id.substring(0, 12),
      name: (container.Names[0] || '').replace(/^\//, ''),
      image: container.Image,
      state: container.State,
      status: container.Status,
      created: container.Created,
    }));
  } catch (error) {
    console.error('Error listing containers:', error);
    throw error;
  }
}

/**
 * GET /api/docker/containers
 * List all project containers
 */
dockerRouter.get('/containers', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const containers = await getProjectContainers();
    res.json(containers);
  } catch (error) {
    console.error('Error getting containers:', error);
    res.status(500).json({ error: 'Failed to get containers' });
  }
});

/**
 * GET /api/docker/containers/:name
 * Get a specific container info
 */
dockerRouter.get('/containers/:name', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    // Security: Only allow project containers
    if (!name.includes(PROJECT_PREFIX)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const container = docker.getContainer(name);
    const info = await container.inspect();

    res.json({
      id: info.Id.substring(0, 12),
      name: info.Name.replace(/^\//, ''),
      image: info.Config.Image,
      state: info.State.Status,
      running: info.State.Running,
      created: info.Created,
    });
  } catch (error) {
    console.error('Error getting container:', error);
    res.status(500).json({ error: 'Failed to get container info' });
  }
});

/**
 * POST /api/docker/containers/:name/start
 * Start a container
 */
dockerRouter.post('/containers/:name/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    // Security: Only allow project containers
    if (!name.includes(PROJECT_PREFIX)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const container = docker.getContainer(name);
    await container.start();

    res.json({ success: true, message: `Container ${name} started` });
  } catch (error) {
    console.error('Error starting container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start container';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/docker/containers/:name/stop
 * Stop a container
 */
dockerRouter.post('/containers/:name/stop', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    // Security: Only allow project containers
    if (!name.includes(PROJECT_PREFIX)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const container = docker.getContainer(name);
    await container.stop();

    res.json({ success: true, message: `Container ${name} stopped` });
  } catch (error) {
    console.error('Error stopping container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to stop container';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * GET /api/docker/phoenixd/status
 * Get phoenixd container status specifically
 */
dockerRouter.get(
  '/phoenixd/status',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const containers = await docker.listContainers({ all: true });

      // First try to find exact match for "phoenixd" container
      let phoenixdContainer = containers.find((container) => {
        const names = container.Names || [];
        return names.some((name) => {
          const cleanName = name.replace(/^\//, '');
          return cleanName === 'phoenixd';
        });
      });

      // If not found, try phoenixd-dashboard project container (phoenixd-phoenixd-1 pattern)
      if (!phoenixdContainer) {
        phoenixdContainer = containers.find((container) => {
          const names = container.Names || [];
          return names.some((name) => {
            const cleanName = name.replace(/^\//, '');
            // Match phoenixd-dashboard project containers only
            return (
              (cleanName.startsWith('phoenixd-') || cleanName.startsWith('phoenixd_')) &&
              cleanName.includes('phoenixd') &&
              !cleanName.includes('backend') &&
              !cleanName.includes('frontend') &&
              !cleanName.includes('postgres')
            );
          });
        });
      }

      if (!phoenixdContainer) {
        return res.json({
          exists: false,
          running: false,
          state: 'not_found',
          name: null,
        });
      }

      res.json({
        exists: true,
        running: phoenixdContainer.State === 'running',
        state: phoenixdContainer.State,
        status: phoenixdContainer.Status,
        name: (phoenixdContainer.Names[0] || '').replace(/^\//, ''),
        id: phoenixdContainer.Id.substring(0, 12),
      });
    } catch (error) {
      console.error('Error getting phoenixd container status:', error);
      res.status(500).json({ error: 'Failed to get phoenixd container status' });
    }
  }
);

/**
 * POST /api/docker/phoenixd/start
 * Start the phoenixd container
 */
dockerRouter.post(
  '/phoenixd/start',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const container = docker.getContainer('phoenixd');
      await container.start();
      res.json({ success: true, message: 'Phoenixd container started' });
    } catch (error: unknown) {
      // Handle "container already started" (HTTP 304) as success
      const dockerError = error as { statusCode?: number; reason?: string };
      if (dockerError.statusCode === 304 || dockerError.reason === 'container already started') {
        return res.json({ success: true, message: 'Phoenixd container is already running' });
      }
      console.error('Error starting phoenixd container:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to start phoenixd container';
      res.status(500).json({ error: errorMessage });
    }
  }
);

/**
 * POST /api/docker/phoenixd/stop
 * Stop the phoenixd container
 */
dockerRouter.post(
  '/phoenixd/stop',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const container = docker.getContainer('phoenixd');
      await container.stop();
      res.json({ success: true, message: 'Phoenixd container stopped' });
    } catch (error: unknown) {
      // Handle "container already stopped" (HTTP 304) as success
      const dockerError = error as { statusCode?: number; reason?: string };
      if (dockerError.statusCode === 304 || dockerError.reason === 'container already stopped') {
        return res.json({ success: true, message: 'Phoenixd container is already stopped' });
      }
      console.error('Error stopping phoenixd container:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to stop phoenixd container';
      res.status(500).json({ error: errorMessage });
    }
  }
);

/**
 * Validate container name belongs to project
 */
export function isProjectContainer(name: string): boolean {
  return name.includes(PROJECT_PREFIX);
}

/**
 * Get Docker client instance (for WebSocket handlers)
 */
export function getDockerClient(): Docker {
  return docker;
}

/**
 * Execute command in container and return output stream
 */
export async function execInContainer(containerName: string, cmd: string[] = ['/bin/sh']) {
  const container = docker.getContainer(containerName);

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });

  return exec.start({
    hijack: true,
    stdin: true,
    Tty: true,
  });
}

/**
 * Get container logs stream
 */
export async function getContainerLogs(containerName: string, tail: number = 100) {
  const container = docker.getContainer(containerName);

  return container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
}
