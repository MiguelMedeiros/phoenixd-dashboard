import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppDockerService } from '../services/app-docker.js';

export const appsRouter = Router();

const appDocker = new AppDockerService();

// Valid source types for apps
const validSourceTypes = ['docker_image', 'github', 'marketplace'];

// Valid webhook events
const validWebhookEvents = ['payment_received', 'payment_sent', 'channel_opened', 'channel_closed'];

// Valid API permissions
const validApiPermissions = [
  'read:balance',
  'read:payments',
  'read:channels',
  'read:node',
  'write:invoices',
  'write:payments',
];

/**
 * Generate a secure API key for an app
 */
function generateApiKey(): string {
  return `phxapp_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate a webhook secret for signing payloads
 */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/apps
 * List all installed apps
 */
appsRouter.get('/', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const apps = await prisma.app.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { webhookLogs: true },
        },
      },
    });

    // Mask API keys in response
    const safeApps = apps.map((app) => ({
      ...app,
      apiKey: app.apiKey ? `${app.apiKey.substring(0, 12)}...` : null,
      webhookSecret: app.webhookSecret ? '***' : null,
    }));

    res.json(safeApps);
  } catch (error) {
    console.error('Error listing apps:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/apps/:id
 * Get app details
 */
appsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.app.findUnique({
      where: { id },
      include: {
        _count: {
          select: { webhookLogs: true },
        },
      },
    });

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Mask API key in response
    res.json({
      ...app,
      apiKey: app.apiKey ? `${app.apiKey.substring(0, 12)}...` : null,
      webhookSecret: app.webhookSecret ? '***' : null,
    });
  } catch (error) {
    console.error('Error getting app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/apps
 * Install a new app
 */
appsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      description,
      icon,
      sourceType,
      sourceUrl,
      version,
      envVars,
      webhookEvents,
      webhookPath,
      apiPermissions,
      internalPort,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!sourceType || !validSourceTypes.includes(sourceType)) {
      return res
        .status(400)
        .json({ error: `Invalid source type. Valid: ${validSourceTypes.join(', ')}` });
    }
    if (!sourceUrl) {
      return res.status(400).json({ error: 'Source URL is required' });
    }

    // Validate webhook events if provided
    if (webhookEvents) {
      const events = typeof webhookEvents === 'string' ? JSON.parse(webhookEvents) : webhookEvents;
      for (const event of events) {
        if (!validWebhookEvents.includes(event)) {
          return res.status(400).json({ error: `Invalid webhook event: ${event}` });
        }
      }
    }

    // Validate API permissions if provided
    if (apiPermissions) {
      const perms =
        typeof apiPermissions === 'string' ? JSON.parse(apiPermissions) : apiPermissions;
      for (const perm of perms) {
        if (!validApiPermissions.includes(perm)) {
          return res.status(400).json({ error: `Invalid API permission: ${perm}` });
        }
      }
    }

    // Generate unique slug
    let slug = generateSlug(name);
    const existingSlug = await prisma.app.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Generate container name
    const containerName = `phoenixd-app-${slug}`;

    // Create app record
    const app = await prisma.app.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        sourceType,
        sourceUrl,
        version: version || 'latest',
        containerName,
        containerStatus: 'stopped',
        internalPort: internalPort || 3000,
        envVars: envVars ? (typeof envVars === 'string' ? envVars : JSON.stringify(envVars)) : null,
        webhookEvents: webhookEvents
          ? typeof webhookEvents === 'string'
            ? webhookEvents
            : JSON.stringify(webhookEvents)
          : null,
        webhookSecret: generateWebhookSecret(),
        webhookPath: webhookPath || '/webhook',
        apiKey: generateApiKey(),
        apiPermissions: apiPermissions
          ? typeof apiPermissions === 'string'
            ? apiPermissions
            : JSON.stringify(apiPermissions)
          : JSON.stringify(['read:balance', 'read:payments']),
        isEnabled: true,
        healthStatus: 'unknown',
      },
    });

    // Try to pull/build the image
    try {
      await appDocker.pullImage(sourceType, sourceUrl, version || 'latest');
    } catch (pullError) {
      console.error('Error pulling app image:', pullError);
      // Update status but don't fail the install
      await prisma.app.update({
        where: { id: app.id },
        data: { containerStatus: 'error', healthStatus: 'unhealthy' },
      });
    }

    res.status(201).json({
      ...app,
      apiKey: app.apiKey, // Return full API key on creation only
    });
  } catch (error) {
    console.error('Error installing app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/apps/:id
 * Update app configuration
 */
appsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      icon,
      envVars,
      webhookEvents,
      webhookPath,
      apiPermissions,
      isEnabled,
      internalPort,
    } = req.body;

    // Check if app exists
    const existing = await prisma.app.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Validate webhook events if provided
    if (webhookEvents) {
      const events = typeof webhookEvents === 'string' ? JSON.parse(webhookEvents) : webhookEvents;
      for (const event of events) {
        if (!validWebhookEvents.includes(event)) {
          return res.status(400).json({ error: `Invalid webhook event: ${event}` });
        }
      }
    }

    // Validate API permissions if provided
    if (apiPermissions) {
      const perms =
        typeof apiPermissions === 'string' ? JSON.parse(apiPermissions) : apiPermissions;
      for (const perm of perms) {
        if (!validApiPermissions.includes(perm)) {
          return res.status(400).json({ error: `Invalid API permission: ${perm}` });
        }
      }
    }

    const app = await prisma.app.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(internalPort !== undefined && { internalPort }),
        ...(envVars !== undefined && {
          envVars: envVars
            ? typeof envVars === 'string'
              ? envVars
              : JSON.stringify(envVars)
            : null,
        }),
        ...(webhookEvents !== undefined && {
          webhookEvents: webhookEvents
            ? typeof webhookEvents === 'string'
              ? webhookEvents
              : JSON.stringify(webhookEvents)
            : null,
        }),
        ...(webhookPath !== undefined && { webhookPath }),
        ...(apiPermissions !== undefined && {
          apiPermissions: apiPermissions
            ? typeof apiPermissions === 'string'
              ? apiPermissions
              : JSON.stringify(apiPermissions)
            : null,
        }),
        ...(isEnabled !== undefined && { isEnabled }),
      },
    });

    // If running and config changed, restart the container
    if (
      existing.containerStatus === 'running' &&
      (envVars !== undefined || internalPort !== undefined)
    ) {
      try {
        await appDocker.restartApp(app);
      } catch (restartError) {
        console.error('Error restarting app after config change:', restartError);
      }
    }

    res.json({
      ...app,
      apiKey: app.apiKey ? `${app.apiKey.substring(0, 12)}...` : null,
      webhookSecret: app.webhookSecret ? '***' : null,
    });
  } catch (error) {
    console.error('Error updating app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/apps/:id
 * Uninstall an app
 */
appsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if app exists
    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Stop and remove container if running
    if (app.containerName) {
      try {
        await appDocker.stopApp(app);
        await appDocker.removeContainer(app.containerName);
      } catch (dockerError) {
        console.error('Error removing app container:', dockerError);
        // Continue with deletion even if container removal fails
      }
    }

    // Delete app and cascade delete webhook logs
    await prisma.app.delete({ where: { id } });

    res.json({ success: true, message: 'App uninstalled successfully' });
  } catch (error) {
    console.error('Error uninstalling app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/apps/:id/start
 * Start an app container
 */
appsRouter.post('/:id/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    if (!app.isEnabled) {
      return res.status(400).json({ error: 'App is disabled' });
    }

    if (app.containerStatus === 'running') {
      return res.json({ success: true, message: 'App is already running' });
    }

    await appDocker.startApp(app);

    await prisma.app.update({
      where: { id },
      data: { containerStatus: 'running', healthStatus: 'unknown' },
    });

    res.json({ success: true, message: 'App started successfully' });
  } catch (error) {
    console.error('Error starting app:', error);

    // Update status to error
    try {
      await prisma.app.update({
        where: { id: req.params.id },
        data: { containerStatus: 'error', healthStatus: 'unhealthy' },
      });
    } catch {
      // Ignore update error
    }

    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/apps/:id/stop
 * Stop an app container
 */
appsRouter.post('/:id/stop', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    if (app.containerStatus === 'stopped') {
      return res.json({ success: true, message: 'App is already stopped' });
    }

    await appDocker.stopApp(app);

    await prisma.app.update({
      where: { id },
      data: { containerStatus: 'stopped' },
    });

    res.json({ success: true, message: 'App stopped successfully' });
  } catch (error) {
    console.error('Error stopping app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/apps/:id/restart
 * Restart an app container
 */
appsRouter.post('/:id/restart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    if (!app.isEnabled) {
      return res.status(400).json({ error: 'App is disabled' });
    }

    await appDocker.restartApp(app);

    await prisma.app.update({
      where: { id },
      data: { containerStatus: 'running', healthStatus: 'unknown' },
    });

    res.json({ success: true, message: 'App restarted successfully' });
  } catch (error) {
    console.error('Error restarting app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/apps/:id/logs
 * Get app container logs
 */
appsRouter.get('/:id/logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tail } = req.query;

    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    if (!app.containerName) {
      return res.status(400).json({ error: 'App has no container' });
    }

    const logs = await appDocker.getLogs(app.containerName, parseInt(tail as string) || 100);
    res.json({ logs });
  } catch (error) {
    console.error('Error getting app logs:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/apps/:id/webhooks
 * Get webhook logs for an app
 */
appsRouter.get('/:id/webhooks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    const webhookLogs = await prisma.appWebhookLog.findMany({
      where: { appId: id },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 50,
      skip: offset ? parseInt(offset as string) : 0,
    });

    res.json(webhookLogs);
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/apps/:id/regenerate-key
 * Regenerate API key for an app
 */
appsRouter.post(
  '/:id/regenerate-key',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const app = await prisma.app.findUnique({ where: { id } });
      if (!app) {
        return res.status(404).json({ error: 'App not found' });
      }

      const newApiKey = generateApiKey();

      await prisma.app.update({
        where: { id },
        data: { apiKey: newApiKey },
      });

      // If running, restart to pick up new key
      if (app.containerStatus === 'running') {
        try {
          await appDocker.restartApp({ ...app, apiKey: newApiKey });
        } catch (restartError) {
          console.error('Error restarting app after key regeneration:', restartError);
        }
      }

      res.json({ apiKey: newApiKey });
    } catch (error) {
      console.error('Error regenerating API key:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps/:id/regenerate-secret
 * Regenerate webhook secret for an app
 */
appsRouter.post(
  '/:id/regenerate-secret',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const app = await prisma.app.findUnique({ where: { id } });
      if (!app) {
        return res.status(404).json({ error: 'App not found' });
      }

      const newSecret = generateWebhookSecret();

      await prisma.app.update({
        where: { id },
        data: { webhookSecret: newSecret },
      });

      // If running, restart to pick up new secret
      if (app.containerStatus === 'running') {
        try {
          await appDocker.restartApp({ ...app, webhookSecret: newSecret });
        } catch (restartError) {
          console.error('Error restarting app after secret regeneration:', restartError);
        }
      }

      res.json({ webhookSecret: newSecret });
    } catch (error) {
      console.error('Error regenerating webhook secret:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps/:id/status
 * Get real-time container status
 */
appsRouter.get('/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const app = await prisma.app.findUnique({ where: { id } });
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    if (!app.containerName) {
      return res.json({
        containerStatus: 'stopped',
        healthStatus: 'unknown',
        running: false,
      });
    }

    const status = await appDocker.getContainerStatus(app.containerName);

    // Update database with latest status
    if (
      status.containerStatus !== app.containerStatus ||
      status.healthStatus !== app.healthStatus
    ) {
      await prisma.app.update({
        where: { id },
        data: {
          containerStatus: status.containerStatus,
          healthStatus: status.healthStatus,
          lastHealthCheck: new Date(),
        },
      });
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting app status:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/apps/webhook-events
 * Get list of available webhook events
 */
appsRouter.get(
  '/meta/webhook-events',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    res.json(validWebhookEvents);
  }
);

/**
 * GET /api/apps/api-permissions
 * Get list of available API permissions
 */
appsRouter.get(
  '/meta/api-permissions',
  requireAuth,
  async (_req: AuthenticatedRequest, res: Response) => {
    res.json(validApiPermissions);
  }
);

/**
 * ALL /api/apps/open/:slug/*
 * Proxy requests to running app containers
 * This allows accessing app UIs through the dashboard
 */
appsRouter.all('/open/:slug/*', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;

    // Find app by slug
    const app = await prisma.app.findUnique({
      where: { slug },
    });

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    if (app.containerStatus !== 'running') {
      return res.status(503).json({ error: 'App is not running. Please start it first.' });
    }

    if (!app.containerName) {
      return res.status(500).json({ error: 'App has no container' });
    }

    // Get the path after /open/:slug/
    const proxyPath = req.params[0] || '';
    const appUrl = `http://${app.containerName}:${app.internalPort}/${proxyPath}`;

    // Forward the request to the app
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const headers: Record<string, string> = {};

      // Forward relevant headers
      if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'] as string;
      }
      if (req.headers['accept']) {
        headers['Accept'] = req.headers['accept'] as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        signal: controller.signal,
      };

      // Include body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(appUrl, fetchOptions);
      clearTimeout(timeout);

      // Get content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Set response headers
      res.status(response.status);
      res.setHeader('Content-Type', contentType);

      // For HTML responses, rewrite URLs to go through the proxy
      if (contentType.includes('text/html')) {
        let html = await response.text();
        // Rewrite relative URLs to go through the proxy
        const baseUrl = `/api/apps/open/${slug}`;
        html = html.replace(/href="\//g, `href="${baseUrl}/`);
        html = html.replace(/src="\//g, `src="${baseUrl}/`);
        html = html.replace(/action="\//g, `action="${baseUrl}/`);
        res.send(html);
      } else if (contentType.includes('application/json')) {
        const json = await response.json();
        res.json(json);
      } else {
        // For other content types, stream the response
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
    } catch (fetchError) {
      clearTimeout(timeout);
      if ((fetchError as Error).name === 'AbortError') {
        return res.status(504).json({ error: 'App request timed out' });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error proxying to app:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/apps/open/:slug
 * Redirect to the app's root (with trailing slash for proper relative URLs)
 */
appsRouter.get('/open/:slug', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { slug } = req.params;
  res.redirect(`/api/apps/open/${slug}/`);
});
