import { Router, Response, Request } from 'express';
import { prisma } from '../index.js';

export const configRouter = Router();

interface DynamicUrls {
  apiUrl: string;
  wsUrl: string;
  tailscaleApiUrl: string | null;
  tailscaleWsUrl: string | null;
  tailscaleFrontendUrl: string | null;
  tailscaleEnabled: boolean;
  tailscaleHealthy: boolean;
  tailscaleDnsName: string | null;
}

/**
 * GET /api/config/urls
 * Get dynamic URLs for frontend to use
 * This endpoint does NOT require authentication so the frontend can bootstrap
 */
configRouter.get('/urls', async (req: Request, res: Response) => {
  try {
    // Default local URLs
    const defaultApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const defaultWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';

    // Get Tailscale settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const tailscaleEnabled = settings?.tailscaleEnabled ?? false;
    const tailscaleDnsName = settings?.tailscaleDnsName || null;

    // Build Tailscale URLs if available
    let tailscaleApiUrl: string | null = null;
    let tailscaleWsUrl: string | null = null;
    let tailscaleFrontendUrl: string | null = null;

    if (tailscaleEnabled && tailscaleDnsName) {
      // Use HTTP for Tailscale (internal network, no SSL needed)
      tailscaleApiUrl = `http://${tailscaleDnsName}:4001`;
      tailscaleWsUrl = `ws://${tailscaleDnsName}:4001`;
      tailscaleFrontendUrl = `http://${tailscaleDnsName}:3000`;
    }

    const urls: DynamicUrls = {
      apiUrl: defaultApiUrl,
      wsUrl: defaultWsUrl,
      tailscaleApiUrl,
      tailscaleWsUrl,
      tailscaleFrontendUrl,
      tailscaleEnabled,
      tailscaleHealthy: tailscaleEnabled && !!tailscaleDnsName,
      tailscaleDnsName,
    };

    res.json(urls);
  } catch (error) {
    console.error('Error getting config URLs:', error);
    // Return defaults on error
    res.json({
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001',
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001',
      tailscaleApiUrl: null,
      tailscaleWsUrl: null,
      tailscaleFrontendUrl: null,
      tailscaleEnabled: false,
      tailscaleHealthy: false,
      tailscaleDnsName: null,
    });
  }
});

/**
 * GET /api/config/detect-access
 * Detect if the current request is coming via Tailscale
 * This helps the frontend decide which URLs to use
 */
configRouter.get('/detect-access', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const tailscaleDnsName = settings?.tailscaleDnsName;
    const host = req.headers.host || '';

    // Check if the request is coming through Tailscale
    // by comparing the host header with the Tailscale DNS name
    const isTailscaleAccess = tailscaleDnsName ? host.includes(tailscaleDnsName) : false;

    res.json({
      isTailscaleAccess,
      host,
      tailscaleDnsName,
    });
  } catch (error) {
    console.error('Error detecting access type:', error);
    res.json({
      isTailscaleAccess: false,
      host: req.headers.host || '',
      tailscaleDnsName: null,
    });
  }
});
