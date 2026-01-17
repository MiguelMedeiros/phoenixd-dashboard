import { Router, Response, Request, NextFunction } from 'express';
import { App } from '@prisma/client';
import { prisma, phoenixd } from '../index.js';

export const appsApiRouter = Router();

// Rate limiting map: appId -> { count, resetTime }
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

// Extend Request type to include authenticated app
interface AppRequest extends Request {
  authenticatedApp?: App;
  appPermissions?: string[];
}

/**
 * Middleware to authenticate apps via API key
 */
async function authenticateApp(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Find app by API key
    const app = await prisma.app.findUnique({
      where: { apiKey },
    });

    if (!app) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (!app.isEnabled) {
      res.status(403).json({ error: 'App is disabled' });
      return;
    }

    // Parse permissions
    let permissions: string[] = [];
    if (app.apiPermissions) {
      try {
        permissions = JSON.parse(app.apiPermissions);
      } catch {
        permissions = [];
      }
    }

    // Rate limiting
    const now = Date.now();
    const limit = rateLimits.get(app.id);

    if (limit) {
      if (now > limit.resetTime) {
        // Reset window
        rateLimits.set(app.id, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      } else if (limit.count >= RATE_LIMIT_MAX) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((limit.resetTime - now) / 1000),
        });
        return;
      } else {
        limit.count++;
      }
    } else {
      rateLimits.set(app.id, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // Attach app and permissions to request
    req.authenticatedApp = app;
    req.appPermissions = permissions;

    next();
  } catch (error) {
    console.error('App authentication error:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Check if app has required permission
 */
function requirePermission(permission: string) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    if (!req.appPermissions?.includes(permission)) {
      res.status(403).json({ error: `Missing required permission: ${permission}` });
      return;
    }
    next();
  };
}

// Apply authentication to all routes
appsApiRouter.use(authenticateApp);

/**
 * GET /api/apps-gateway/info
 * Get info about the authenticated app
 */
appsApiRouter.get('/info', (req: AppRequest, res: Response) => {
  const app = req.authenticatedApp!;
  res.json({
    id: app.id,
    slug: app.slug,
    name: app.name,
    permissions: req.appPermissions,
  });
});

/**
 * GET /api/apps-gateway/node
 * Get node info
 */
appsApiRouter.get(
  '/node',
  requirePermission('read:node'),
  async (_req: AppRequest, res: Response) => {
    try {
      const info = await phoenixd.getInfo();
      res.json({
        nodeId: info.nodeId,
        channelCount: info.channels?.length || 0,
      });
    } catch (error) {
      console.error('Error getting node info:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/balance
 * Get node balance
 */
appsApiRouter.get(
  '/balance',
  requirePermission('read:balance'),
  async (_req: AppRequest, res: Response) => {
    try {
      const balance = await phoenixd.getBalance();
      res.json(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/channels
 * List channels
 */
appsApiRouter.get(
  '/channels',
  requirePermission('read:channels'),
  async (_req: AppRequest, res: Response) => {
    try {
      const channels = await phoenixd.listChannels();
      res.json(channels);
    } catch (error) {
      console.error('Error listing channels:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/payments/incoming
 * List incoming payments
 */
appsApiRouter.get(
  '/payments/incoming',
  requirePermission('read:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { limit, offset, from, to } = req.query;

      const payments = await phoenixd.listIncomingPayments({
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        from: from ? parseInt(from as string) : undefined,
        to: to ? parseInt(to as string) : undefined,
      });

      res.json(payments);
    } catch (error) {
      console.error('Error listing incoming payments:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/payments/incoming/:paymentHash
 * Get a specific incoming payment
 */
appsApiRouter.get(
  '/payments/incoming/:paymentHash',
  requirePermission('read:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { paymentHash } = req.params;
      const payment = await phoenixd.getIncomingPayment(paymentHash);
      res.json(payment);
    } catch (error) {
      console.error('Error getting incoming payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/payments/outgoing
 * List outgoing payments
 */
appsApiRouter.get(
  '/payments/outgoing',
  requirePermission('read:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { limit, offset, from, to } = req.query;

      const payments = await phoenixd.listOutgoingPayments({
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        from: from ? parseInt(from as string) : undefined,
        to: to ? parseInt(to as string) : undefined,
      });

      res.json(payments);
    } catch (error) {
      console.error('Error listing outgoing payments:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/payments/outgoing/:paymentId
 * Get a specific outgoing payment
 */
appsApiRouter.get(
  '/payments/outgoing/:paymentId',
  requirePermission('read:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { paymentId } = req.params;
      const payment = await phoenixd.getOutgoingPayment(paymentId);
      res.json(payment);
    } catch (error) {
      console.error('Error getting outgoing payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/invoices
 * Create an invoice
 */
appsApiRouter.post(
  '/invoices',
  requirePermission('write:invoices'),
  async (req: AppRequest, res: Response) => {
    try {
      const { amountSat, description, expirySeconds, externalId } = req.body;

      const invoice = await phoenixd.createInvoice({
        amountSat,
        description,
        expirySeconds,
        externalId,
      });

      res.status(201).json(invoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/offers
 * Create an offer
 */
appsApiRouter.post(
  '/offers',
  requirePermission('write:invoices'),
  async (req: AppRequest, res: Response) => {
    try {
      const { amountSat, description } = req.body;

      const offer = await phoenixd.createOffer({
        amountSat,
        description,
      });

      res.status(201).json(offer);
    } catch (error) {
      console.error('Error creating offer:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/lnaddress
 * Get the Lightning Address
 */
appsApiRouter.get(
  '/lnaddress',
  requirePermission('read:node'),
  async (_req: AppRequest, res: Response) => {
    try {
      const lnaddress = await phoenixd.getLnAddress();
      res.json({ lnaddress });
    } catch (error) {
      console.error('Error getting LN address:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/pay/invoice
 * Pay an invoice
 */
appsApiRouter.post(
  '/pay/invoice',
  requirePermission('write:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { invoice, amountSat } = req.body;

      if (!invoice) {
        res.status(400).json({ error: 'Invoice is required' });
        return;
      }

      const result = await phoenixd.payInvoice({ invoice, amountSat });
      res.json(result);
    } catch (error) {
      console.error('Error paying invoice:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/pay/offer
 * Pay an offer
 */
appsApiRouter.post(
  '/pay/offer',
  requirePermission('write:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { offer, amountSat, message } = req.body;

      if (!offer || !amountSat) {
        res.status(400).json({ error: 'Offer and amountSat are required' });
        return;
      }

      const result = await phoenixd.payOffer({ offer, amountSat, message });
      res.json(result);
    } catch (error) {
      console.error('Error paying offer:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/pay/lnaddress
 * Pay a Lightning Address
 */
appsApiRouter.post(
  '/pay/lnaddress',
  requirePermission('write:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { address, amountSat, message } = req.body;

      if (!address || !amountSat) {
        res.status(400).json({ error: 'Address and amountSat are required' });
        return;
      }

      const result = await phoenixd.payLnAddress({ address, amountSat, message });
      res.json(result);
    } catch (error) {
      console.error('Error paying LN address:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/decode/invoice
 * Decode a BOLT11 invoice
 */
appsApiRouter.post(
  '/decode/invoice',
  requirePermission('read:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { invoice } = req.body;

      if (!invoice) {
        res.status(400).json({ error: 'Invoice is required' });
        return;
      }

      const decoded = await phoenixd.decodeInvoice(invoice);
      res.json(decoded);
    } catch (error) {
      console.error('Error decoding invoice:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * POST /api/apps-gateway/decode/offer
 * Decode a BOLT12 offer
 */
appsApiRouter.post(
  '/decode/offer',
  requirePermission('read:payments'),
  async (req: AppRequest, res: Response) => {
    try {
      const { offer } = req.body;

      if (!offer) {
        res.status(400).json({ error: 'Offer is required' });
        return;
      }

      const decoded = await phoenixd.decodeOffer(offer);
      res.json(decoded);
    } catch (error) {
      console.error('Error decoding offer:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * GET /api/apps-gateway/estimate-fees
 * Estimate liquidity fees
 */
appsApiRouter.get(
  '/estimate-fees',
  requirePermission('read:balance'),
  async (req: AppRequest, res: Response) => {
    try {
      const { amountSat } = req.query;

      if (!amountSat) {
        res.status(400).json({ error: 'amountSat query parameter is required' });
        return;
      }

      const fees = await phoenixd.estimateLiquidityFees(parseInt(amountSat as string));
      res.json(fees);
    } catch (error) {
      console.error('Error estimating fees:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);
