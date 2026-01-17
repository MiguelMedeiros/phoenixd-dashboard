import Docker from 'dockerode';
import { App } from '@prisma/client';
import { prisma, phoenixd } from '../index.js';

// Initialize Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Network name for phoenixd apps
const PHOENIXD_NETWORK = 'phoenixd-dashboard_phoenixd-network';

// Container label prefix for app containers
const APP_LABEL_PREFIX = 'phoenixd-app';

export interface ContainerStatus {
  containerStatus: 'running' | 'stopped' | 'error' | 'not_found';
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  running: boolean;
}

export class AppDockerService {
  /**
   * Pull a Docker image from registry
   */
  async pullImage(
    sourceType: string,
    sourceUrl: string,
    version: string = 'latest'
  ): Promise<void> {
    if (sourceType === 'github') {
      // For GitHub, we'd need to build the image - not implemented yet
      throw new Error('GitHub source type not yet implemented. Use docker_image instead.');
    }

    // For docker_image and marketplace, pull from registry
    const imageName = sourceUrl.includes(':') ? sourceUrl : `${sourceUrl}:${version}`;
    console.log(`Pulling Docker image: ${imageName}`);

    return new Promise((resolve, reject) => {
      docker.pull(imageName, {}, (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
        if (err) {
          console.error('Error pulling image:', err);
          return reject(err);
        }

        if (!stream) {
          return reject(new Error('No stream returned from pull'));
        }

        // Follow the pull progress
        docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              console.error('Error during pull:', err);
              return reject(err);
            }
            console.log(`Successfully pulled image: ${imageName}`);
            resolve();
          },
          (event: { status?: string; progress?: string }) => {
            if (event.status) {
              console.log(`Pull progress: ${event.status} ${event.progress || ''}`);
            }
          }
        );
      });
    });
  }

  /**
   * Get environment variables to inject into app container
   */
  private async getAppEnvVars(app: App): Promise<string[]> {
    const envVars: string[] = [];

    // Dashboard connection
    envVars.push('PHOENIXD_DASHBOARD_URL=http://phoenixd-backend:4000');
    envVars.push(`PHOENIXD_APP_API_KEY=${app.apiKey || ''}`);
    envVars.push(`PHOENIXD_WEBHOOK_SECRET=${app.webhookSecret || ''}`);

    // Get node info
    try {
      const nodeInfo = phoenixd.getConfig();
      const _fullConfig = phoenixd.getFullConfig();

      // Try to get node ID from cached info
      const cachedNodeInfo = await prisma.nodeInfo.findUnique({
        where: { id: 'singleton' },
      });

      if (cachedNodeInfo) {
        envVars.push(`PHOENIXD_NODE_ID=${cachedNodeInfo.nodeId}`);
        envVars.push(`PHOENIXD_CHAIN=${cachedNodeInfo.chain}`);
      }

      envVars.push(`PHOENIXD_IS_EXTERNAL=${nodeInfo.isExternal}`);
    } catch (error) {
      console.error('Error getting node info for app env vars:', error);
    }

    // Parse and add custom env vars from app config
    if (app.envVars) {
      try {
        const customVars = JSON.parse(app.envVars) as Record<string, string>;
        for (const [key, value] of Object.entries(customVars)) {
          envVars.push(`${key}=${value}`);
        }
      } catch (error) {
        console.error('Error parsing app envVars:', error);
      }
    }

    return envVars;
  }

  /**
   * Start an app container
   */
  async startApp(app: App): Promise<void> {
    if (!app.containerName) {
      throw new Error('App has no container name');
    }

    // Check if container already exists
    try {
      const container = docker.getContainer(app.containerName);
      const info = await container.inspect();

      if (info.State.Running) {
        console.log(`Container ${app.containerName} is already running`);
        return;
      }

      // Container exists but not running - start it
      console.log(`Starting existing container: ${app.containerName}`);
      await container.start();
      return;
    } catch (error: unknown) {
      const dockerError = error as { statusCode?: number };
      if (dockerError.statusCode !== 404) {
        throw error;
      }
      // Container doesn't exist, create it
    }

    // Determine image name
    const imageName =
      app.version && !app.sourceUrl.includes(':')
        ? `${app.sourceUrl}:${app.version}`
        : app.sourceUrl;

    console.log(`Creating container ${app.containerName} from image ${imageName}`);

    // Get environment variables
    const envVars = await this.getAppEnvVars(app);

    // Create container
    const container = await docker.createContainer({
      name: app.containerName,
      Image: imageName,
      Env: envVars,
      Labels: {
        [`${APP_LABEL_PREFIX}`]: 'true',
        [`${APP_LABEL_PREFIX}.id`]: app.id,
        [`${APP_LABEL_PREFIX}.slug`]: app.slug,
        'com.docker.compose.project': 'phoenixd-dashboard',
      },
      HostConfig: {
        NetworkMode: PHOENIXD_NETWORK,
        RestartPolicy: { Name: 'unless-stopped' },
        // Resource limits
        Memory: 512 * 1024 * 1024, // 512MB
        NanoCpus: 1000000000, // 1 CPU
      },
      // Healthcheck for the app
      Healthcheck: {
        Test: ['CMD-SHELL', `curl -f http://localhost:${app.internalPort}/health || exit 1`],
        Interval: 30000000000, // 30s in nanoseconds
        Timeout: 10000000000, // 10s
        Retries: 3,
        StartPeriod: 30000000000, // 30s
      },
    });

    await container.start();
    console.log(`Container ${app.containerName} started successfully`);
  }

  /**
   * Stop an app container
   */
  async stopApp(app: App): Promise<void> {
    if (!app.containerName) {
      throw new Error('App has no container name');
    }

    try {
      const container = docker.getContainer(app.containerName);
      const info = await container.inspect();

      if (!info.State.Running) {
        console.log(`Container ${app.containerName} is already stopped`);
        return;
      }

      console.log(`Stopping container: ${app.containerName}`);
      await container.stop({ t: 10 }); // 10 second timeout
      console.log(`Container ${app.containerName} stopped successfully`);
    } catch (error: unknown) {
      const dockerError = error as { statusCode?: number };
      if (dockerError.statusCode === 404) {
        console.log(`Container ${app.containerName} not found`);
        return;
      }
      throw error;
    }
  }

  /**
   * Restart an app container
   */
  async restartApp(app: App): Promise<void> {
    if (!app.containerName) {
      throw new Error('App has no container name');
    }

    try {
      const container = docker.getContainer(app.containerName);

      // Remove old container
      try {
        const info = await container.inspect();
        if (info.State.Running) {
          await container.stop({ t: 10 });
        }
        await container.remove();
      } catch (error: unknown) {
        const dockerError = error as { statusCode?: number };
        if (dockerError.statusCode !== 404) {
          throw error;
        }
      }

      // Start fresh container with new config
      await this.startApp(app);
    } catch (error) {
      console.error(`Error restarting container ${app.containerName}:`, error);
      throw error;
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(containerName: string): Promise<void> {
    try {
      const container = docker.getContainer(containerName);

      try {
        const info = await container.inspect();
        if (info.State.Running) {
          await container.stop({ t: 10 });
        }
      } catch {
        // Ignore errors during stop
      }

      await container.remove({ force: true });
      console.log(`Container ${containerName} removed successfully`);
    } catch (error: unknown) {
      const dockerError = error as { statusCode?: number };
      if (dockerError.statusCode === 404) {
        console.log(`Container ${containerName} not found`);
        return;
      }
      throw error;
    }
  }

  /**
   * Get container logs
   */
  async getLogs(containerName: string, tail: number = 100): Promise<string> {
    try {
      const container = docker.getContainer(containerName);

      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      // Parse Docker multiplexed stream if needed
      if (Buffer.isBuffer(logs)) {
        return this.parseDockerLogs(logs);
      }

      return String(logs);
    } catch (error: unknown) {
      const dockerError = error as { statusCode?: number };
      if (dockerError.statusCode === 404) {
        return 'Container not found';
      }
      throw error;
    }
  }

  /**
   * Parse Docker multiplexed log stream
   */
  private parseDockerLogs(buffer: Buffer): string {
    let result = '';
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) {
        result += buffer.slice(offset).toString('utf8');
        break;
      }

      const streamType = buffer.readUInt8(offset);
      const payloadSize = buffer.readUInt32BE(offset + 4);

      if (streamType > 2) {
        result += buffer.slice(offset).toString('utf8');
        break;
      }

      offset += 8;

      if (offset + payloadSize <= buffer.length) {
        result += buffer.slice(offset, offset + payloadSize).toString('utf8');
        offset += payloadSize;
      } else {
        result += buffer.slice(offset).toString('utf8');
        break;
      }
    }

    return result;
  }

  /**
   * Get container status
   */
  async getContainerStatus(containerName: string): Promise<ContainerStatus> {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();

      let healthStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
      if (info.State.Health) {
        healthStatus = info.State.Health.Status === 'healthy' ? 'healthy' : 'unhealthy';
      }

      return {
        containerStatus: info.State.Running ? 'running' : 'stopped',
        healthStatus,
        running: info.State.Running,
      };
    } catch (error: unknown) {
      const dockerError = error as { statusCode?: number };
      if (dockerError.statusCode === 404) {
        return {
          containerStatus: 'not_found',
          healthStatus: 'unknown',
          running: false,
        };
      }
      return {
        containerStatus: 'error',
        healthStatus: 'unhealthy',
        running: false,
      };
    }
  }

  /**
   * List all app containers
   */
  async listAppContainers(): Promise<
    Array<{ id: string; name: string; status: string; appId: string }>
  > {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        label: [`${APP_LABEL_PREFIX}=true`],
      },
    });

    return containers.map((container) => ({
      id: container.Id.substring(0, 12),
      name: (container.Names[0] || '').replace(/^\//, ''),
      status: container.State,
      appId: container.Labels[`${APP_LABEL_PREFIX}.id`] || '',
    }));
  }

  /**
   * Get the internal URL for an app (for webhook delivery)
   */
  getAppInternalUrl(app: App): string {
    if (!app.containerName) {
      throw new Error('App has no container name');
    }
    return `http://${app.containerName}:${app.internalPort}`;
  }

  /**
   * Check if an app is reachable
   */
  async healthCheck(app: App): Promise<'healthy' | 'unhealthy'> {
    if (!app.containerName || app.containerStatus !== 'running') {
      return 'unhealthy';
    }

    try {
      const url = `${this.getAppInternalUrl(app)}/health`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      return response.ok ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Update health status for all running apps
   */
  async updateAllHealthStatuses(): Promise<void> {
    const apps = await prisma.app.findMany({
      where: { containerStatus: 'running' },
    });

    for (const app of apps) {
      try {
        const health = await this.healthCheck(app);
        await prisma.app.update({
          where: { id: app.id },
          data: {
            healthStatus: health,
            lastHealthCheck: new Date(),
          },
        });
      } catch (error) {
        console.error(`Error checking health for app ${app.slug}:`, error);
      }
    }
  }
}
