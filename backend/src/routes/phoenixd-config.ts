import { Router, Response } from 'express';
import { prisma, phoenixd, reconnectPhoenixdWebSocket } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/phoenixd/config
 * Get current phoenixd connection configuration
 */
router.get('/config', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const config = phoenixd.getConfig();

    res.json({
      useExternalPhoenixd: settings?.useExternalPhoenixd || false,
      phoenixdUrl: settings?.phoenixdUrl || '',
      hasPassword: !!settings?.phoenixdPassword,
      // Current active config
      activeUrl: config.url,
      activeIsExternal: config.isExternal,
      activeHasPassword: config.hasPassword,
    });
  } catch (error) {
    console.error('Error getting phoenixd config:', error);
    res.status(500).json({ error: 'Failed to get phoenixd configuration' });
  }
});

/**
 * PUT /api/phoenixd/config
 * Save phoenixd connection configuration
 */
router.put('/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { useExternalPhoenixd, phoenixdUrl, phoenixdPassword } = req.body;

    // Validate URL if using external phoenixd
    if (useExternalPhoenixd) {
      if (!phoenixdUrl || typeof phoenixdUrl !== 'string') {
        return res.status(400).json({ error: 'Phoenixd URL is required when using external connection' });
      }

      // Basic URL validation
      try {
        new URL(phoenixdUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // Update settings in database
    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        useExternalPhoenixd: !!useExternalPhoenixd,
        phoenixdUrl: useExternalPhoenixd ? phoenixdUrl : null,
        phoenixdPassword: useExternalPhoenixd ? (phoenixdPassword || null) : null,
      },
      create: {
        id: 'singleton',
        useExternalPhoenixd: !!useExternalPhoenixd,
        phoenixdUrl: useExternalPhoenixd ? phoenixdUrl : null,
        phoenixdPassword: useExternalPhoenixd ? (phoenixdPassword || null) : null,
      },
    });

    // Update the phoenixd service configuration
    if (settings.useExternalPhoenixd && settings.phoenixdUrl) {
      phoenixd.updateConfig(
        settings.phoenixdUrl,
        settings.phoenixdPassword || '',
        true
      );
    } else {
      phoenixd.resetToDefault();
    }

    // Reconnect WebSocket with new configuration
    reconnectPhoenixdWebSocket();

    res.json({
      success: true,
      message: 'Phoenixd configuration updated',
      useExternalPhoenixd: settings.useExternalPhoenixd,
      phoenixdUrl: settings.phoenixdUrl || '',
    });
  } catch (error) {
    console.error('Error saving phoenixd config:', error);
    res.status(500).json({ error: 'Failed to save phoenixd configuration' });
  }
});

/**
 * POST /api/phoenixd/test-connection
 * Test connection to an external phoenixd instance
 */
router.post('/test-connection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, password } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Test the connection
    const nodeInfo = await phoenixd.testConnection(url, password || '');

    res.json({
      success: true,
      message: 'Connection successful',
      nodeId: nodeInfo.nodeId,
      chain: nodeInfo.chain,
      version: nodeInfo.version,
    });
  } catch (error) {
    console.error('Error testing phoenixd connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    res.status(400).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

/**
 * POST /api/phoenixd/reconnect
 * Force reconnect the phoenixd WebSocket
 */
router.post('/reconnect', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    reconnectPhoenixdWebSocket();
    res.json({
      success: true,
      message: 'WebSocket reconnection initiated',
    });
  } catch (error) {
    console.error('Error reconnecting phoenixd WebSocket:', error);
    res.status(500).json({ error: 'Failed to reconnect WebSocket' });
  }
});

/**
 * GET /api/phoenixd/connection-status
 * Get current connection status
 */
router.get('/connection-status', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const config = phoenixd.getConfig();
    
    // Try to get node info to verify connection is working
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
      connected,
      nodeId,
      error,
      url: config.url,
      isExternal: config.isExternal,
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

export const phoenixdConfigRouter = router;
