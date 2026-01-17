import { Router, Response } from 'express';
import { prisma, phoenixd, reconnectPhoenixdWebSocket } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Default Docker URL from environment
const DOCKER_PHOENIXD_URL = process.env.PHOENIXD_URL || 'http://phoenixd:9740';
const DOCKER_PHOENIXD_PASSWORD = process.env.PHOENIXD_PASSWORD || '';

/**
 * GET /api/phoenixd-connections
 * List all saved phoenixd connections
 */
router.get('/', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const connections = await prisma.phoenixdConnection.findMany({
      orderBy: [
        { isDocker: 'desc' }, // Docker first
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        url: true,
        isDocker: true,
        isActive: true,
        nodeId: true,
        chain: true,
        lastConnectedAt: true,
        createdAt: true,
      },
    });

    res.json(connections);
  } catch (error) {
    console.error('Error listing phoenixd connections:', error);
    res.status(500).json({ error: 'Failed to list connections' });
  }
});

/**
 * GET /api/phoenixd-connections/active
 * Get the currently active connection with status
 */
router.get('/active', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const activeConnection = await prisma.phoenixdConnection.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        url: true,
        isDocker: true,
        isActive: true,
        nodeId: true,
        chain: true,
        lastConnectedAt: true,
      },
    });

    // Check connection status
    let connected = false;
    let nodeId: string | null = null;
    let error: string | null = null;

    try {
      const info = await phoenixd.getInfo();
      connected = true;
      nodeId = info.nodeId;
    } catch (err) {
      connected = false;
      error = err instanceof Error ? err.message : 'Connection failed';
    }

    res.json({
      connection: activeConnection,
      status: {
        connected,
        nodeId,
        error,
      },
    });
  } catch (error) {
    console.error('Error getting active connection:', error);
    res.status(500).json({ error: 'Failed to get active connection' });
  }
});

/**
 * POST /api/phoenixd-connections
 * Create a new phoenixd connection
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, url, password } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Test connection before saving
    let nodeId: string | undefined;
    let chain: string | undefined;
    try {
      const testResult = await phoenixd.testConnection(url, password || '');
      nodeId = testResult.nodeId;
      chain = testResult.chain;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      return res.status(400).json({ error: `Connection failed: ${errorMessage}` });
    }

    const connection = await prisma.phoenixdConnection.create({
      data: {
        name: name.trim(),
        url,
        password: password || null,
        isDocker: false,
        isActive: false,
        nodeId,
        chain,
        lastConnectedAt: new Date(),
      },
    });

    res.status(201).json({
      id: connection.id,
      name: connection.name,
      url: connection.url,
      isDocker: connection.isDocker,
      isActive: connection.isActive,
      nodeId: connection.nodeId,
      chain: connection.chain,
      lastConnectedAt: connection.lastConnectedAt,
      createdAt: connection.createdAt,
    });
  } catch (error) {
    console.error('Error creating phoenixd connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

/**
 * PUT /api/phoenixd-connections/:id
 * Update an existing phoenixd connection
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, password } = req.body;

    const existing = await prisma.phoenixdConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Docker connection can only have its name updated
    if (existing.isDocker) {
      if (url || password) {
        return res.status(400).json({ error: 'Cannot modify Docker connection URL or password' });
      }
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // If URL or password changed, test connection
    let nodeId = existing.nodeId;
    let chain = existing.chain;
    const newUrl = url || existing.url;
    const newPassword = password !== undefined ? password : existing.password;

    if (
      (url && url !== existing.url) ||
      (password !== undefined && password !== existing.password)
    ) {
      try {
        const testResult = await phoenixd.testConnection(newUrl, newPassword || '');
        nodeId = testResult.nodeId;
        chain = testResult.chain || null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
        return res.status(400).json({ error: `Connection failed: ${errorMessage}` });
      }
    }

    const updated = await prisma.phoenixdConnection.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        url: existing.isDocker ? existing.url : newUrl,
        password: existing.isDocker ? existing.password : newPassword,
        nodeId,
        chain,
        lastConnectedAt: new Date(),
      },
    });

    // If this was the active connection, update the phoenixd service
    if (updated.isActive) {
      phoenixd.updateConfig(updated.url, updated.password || '', !updated.isDocker);
      reconnectPhoenixdWebSocket();
    }

    res.json({
      id: updated.id,
      name: updated.name,
      url: updated.url,
      isDocker: updated.isDocker,
      isActive: updated.isActive,
      nodeId: updated.nodeId,
      chain: updated.chain,
      lastConnectedAt: updated.lastConnectedAt,
    });
  } catch (error) {
    console.error('Error updating phoenixd connection:', error);
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

/**
 * DELETE /api/phoenixd-connections/:id
 * Delete a phoenixd connection (not Docker)
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.phoenixdConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (existing.isDocker) {
      return res.status(400).json({ error: 'Cannot delete the Docker connection' });
    }

    if (existing.isActive) {
      return res.status(400).json({
        error: 'Cannot delete the active connection. Switch to another connection first.',
      });
    }

    await prisma.phoenixdConnection.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Connection deleted' });
  } catch (error) {
    console.error('Error deleting phoenixd connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

/**
 * POST /api/phoenixd-connections/:id/activate
 * Switch to this connection
 */
router.post('/:id/activate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const connection = await prisma.phoenixdConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Test connection first
    try {
      const testResult = await phoenixd.testConnection(connection.url, connection.password || '');

      // Update connection with latest node info
      await prisma.phoenixdConnection.update({
        where: { id },
        data: {
          nodeId: testResult.nodeId,
          chain: testResult.chain,
          lastConnectedAt: new Date(),
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      return res.status(400).json({ error: `Cannot activate: ${errorMessage}` });
    }

    // Deactivate all connections and activate this one
    await prisma.$transaction([
      prisma.phoenixdConnection.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.phoenixdConnection.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    // Update phoenixd service
    phoenixd.updateConfig(connection.url, connection.password || '', !connection.isDocker);
    reconnectPhoenixdWebSocket();

    res.json({
      success: true,
      message: `Switched to ${connection.name}`,
      connection: {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        isDocker: connection.isDocker,
      },
    });
  } catch (error) {
    console.error('Error activating phoenixd connection:', error);
    res.status(500).json({ error: 'Failed to activate connection' });
  }
});

/**
 * POST /api/phoenixd-connections/:id/test
 * Test a saved connection
 */
router.post('/:id/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const connection = await prisma.phoenixdConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    try {
      const testResult = await phoenixd.testConnection(connection.url, connection.password || '');

      // Update cached info
      await prisma.phoenixdConnection.update({
        where: { id },
        data: {
          nodeId: testResult.nodeId,
          chain: testResult.chain,
          lastConnectedAt: new Date(),
        },
      });

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

/**
 * POST /api/phoenixd-connections/test
 * Test a connection without saving (for add form)
 */
router.post('/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, password } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

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

/**
 * Initialize Docker connection on startup
 */
export async function initializeDockerConnection(): Promise<void> {
  try {
    // Check if Docker connection exists
    const dockerConnection = await prisma.phoenixdConnection.findFirst({
      where: { isDocker: true },
    });

    if (!dockerConnection) {
      console.log('Creating default Docker connection...');

      // Check if any connections exist
      const connectionCount = await prisma.phoenixdConnection.count();

      await prisma.phoenixdConnection.create({
        data: {
          name: 'Docker (Local)',
          url: DOCKER_PHOENIXD_URL,
          password: DOCKER_PHOENIXD_PASSWORD,
          isDocker: true,
          isActive: connectionCount === 0, // Active if no other connections
        },
      });
    }

    // Migrate from old Settings if needed
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (settings?.useExternalPhoenixd && settings?.phoenixdUrl) {
      // Check if this URL already exists
      const existingConnection = await prisma.phoenixdConnection.findFirst({
        where: { url: settings.phoenixdUrl },
      });

      if (!existingConnection) {
        console.log('Migrating external phoenixd configuration from Settings...');

        // Deactivate Docker connection
        await prisma.phoenixdConnection.updateMany({
          where: { isDocker: true },
          data: { isActive: false },
        });

        // Create external connection
        await prisma.phoenixdConnection.create({
          data: {
            name: 'External Phoenixd (Migrated)',
            url: settings.phoenixdUrl,
            password: settings.phoenixdPassword,
            isDocker: false,
            isActive: true,
          },
        });
      }
    }

    // Get active connection and configure service
    const activeConnection = await prisma.phoenixdConnection.findFirst({
      where: { isActive: true },
    });

    if (activeConnection) {
      console.log(`Using active connection: ${activeConnection.name} (${activeConnection.url})`);
      phoenixd.updateConfig(
        activeConnection.url,
        activeConnection.password || '',
        !activeConnection.isDocker
      );
    } else {
      // If no active connection, activate Docker
      const docker = await prisma.phoenixdConnection.findFirst({
        where: { isDocker: true },
      });

      if (docker) {
        await prisma.phoenixdConnection.update({
          where: { id: docker.id },
          data: { isActive: true },
        });
        console.log('Activated Docker connection as default');
        phoenixd.updateConfig(docker.url, docker.password || '', false);
      }
    }
  } catch (error) {
    console.error('Error initializing Docker connection:', error);
  }
}

export const phoenixdConnectionsRouter = router;
