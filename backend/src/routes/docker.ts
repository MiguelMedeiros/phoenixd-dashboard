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
    const projectContainers = containers.filter(container => {
      const names = container.Names || [];
      return names.some(name => name.includes(PROJECT_PREFIX));
    });

    return projectContainers.map(container => ({
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
