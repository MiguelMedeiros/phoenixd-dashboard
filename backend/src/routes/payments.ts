import { Router, Response } from 'express';
import { phoenixd } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const paymentsRouter = Router();

// List Incoming Payments
paymentsRouter.get('/incoming', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to, limit, offset, all, externalId } = req.query;
    // Fetch a large number of payments to sort properly (phoenixd returns oldest first)
    const allPayments = await phoenixd.listIncomingPayments({
      from: from ? parseInt(from as string) : undefined,
      to: to ? parseInt(to as string) : undefined,
      limit: 10000, // Fetch up to 10k payments for proper sorting
      all: all === 'true',
      externalId: externalId as string | undefined,
    });

    // Sort by newest first (phoenixd returns oldest first by default)
    const sorted = sortByNewest(allPayments as Array<{ completedAt?: number; createdAt: number }>);

    // Apply pagination after sorting
    const parsedLimit = limit ? parseInt(limit as string) : undefined;
    const parsedOffset = offset ? parseInt(offset as string) : 0;

    let result = sorted;
    if (parsedLimit !== undefined) {
      result = sorted.slice(parsedOffset, parsedOffset + parsedLimit);
    }

    // Add total count header
    res.setHeader('X-Total-Count', sorted.length.toString());
    res.json(result);
  } catch (error) {
    console.error('Error listing incoming payments:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Incoming Payment by Hash
paymentsRouter.get(
  '/incoming/:paymentHash',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { paymentHash } = req.params;
      const result = await phoenixd.getIncomingPayment(paymentHash);
      res.json(result);
    } catch (error) {
      console.error('Error getting incoming payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Helper to sort payments by newest first
function sortByNewest<T extends { completedAt?: number; createdAt: number }>(payments: T[]): T[] {
  return [...payments].sort((a, b) => {
    const aTime = a.completedAt || a.createdAt;
    const bTime = b.completedAt || b.createdAt;
    return bTime - aTime; // Descending order (newest first)
  });
}

// List Outgoing Payments
paymentsRouter.get('/outgoing', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to, limit, offset, all } = req.query;
    // Fetch a large number of payments to sort properly (phoenixd returns oldest first)
    // We need to fetch enough to cover the requested page after sorting by newest
    const allPayments = await phoenixd.listOutgoingPayments({
      from: from ? parseInt(from as string) : undefined,
      to: to ? parseInt(to as string) : undefined,
      limit: 10000, // Fetch up to 10k payments for proper sorting
      all: all === 'true',
    });

    // Sort by newest first (phoenixd returns oldest first by default)
    const sorted = sortByNewest(allPayments as Array<{ completedAt?: number; createdAt: number }>);

    // Apply pagination after sorting
    const parsedLimit = limit ? parseInt(limit as string) : undefined;
    const parsedOffset = offset ? parseInt(offset as string) : 0;

    let result = sorted;
    if (parsedLimit !== undefined) {
      result = sorted.slice(parsedOffset, parsedOffset + parsedLimit);
    }

    // Add total count header
    res.setHeader('X-Total-Count', sorted.length.toString());
    res.json(result);
  } catch (error) {
    console.error('Error listing outgoing payments:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Outgoing Payment by ID
paymentsRouter.get(
  '/outgoing/:paymentId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { paymentId } = req.params;
      const result = await phoenixd.getOutgoingPayment(paymentId);
      res.json(result);
    } catch (error) {
      console.error('Error getting outgoing payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get Outgoing Payment by Hash
paymentsRouter.get(
  '/outgoingbyhash/:paymentHash',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { paymentHash } = req.params;
      const result = await phoenixd.getOutgoingPaymentByHash(paymentHash);
      res.json(result);
    } catch (error) {
      console.error('Error getting outgoing payment by hash:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);
