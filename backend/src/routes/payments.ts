import { Router, Response } from 'express';
import { phoenixd } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const paymentsRouter = Router();

// List Incoming Payments
paymentsRouter.get('/incoming', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to, limit, offset, all, externalId } = req.query;
    const result = await phoenixd.listIncomingPayments({
      from: from ? parseInt(from as string) : undefined,
      to: to ? parseInt(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      all: all === 'true',
      externalId: externalId as string | undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing incoming payments:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Incoming Payment by Hash
paymentsRouter.get('/incoming/:paymentHash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentHash } = req.params;
    const result = await phoenixd.getIncomingPayment(paymentHash);
    res.json(result);
  } catch (error) {
    console.error('Error getting incoming payment:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// List Outgoing Payments
paymentsRouter.get('/outgoing', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to, limit, offset, all } = req.query;
    const result = await phoenixd.listOutgoingPayments({
      from: from ? parseInt(from as string) : undefined,
      to: to ? parseInt(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      all: all === 'true',
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing outgoing payments:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Outgoing Payment by ID
paymentsRouter.get('/outgoing/:paymentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const result = await phoenixd.getOutgoingPayment(paymentId);
    res.json(result);
  } catch (error) {
    console.error('Error getting outgoing payment:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Outgoing Payment by Hash
paymentsRouter.get('/outgoingbyhash/:paymentHash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentHash } = req.params;
    const result = await phoenixd.getOutgoingPaymentByHash(paymentHash);
    res.json(result);
  } catch (error) {
    console.error('Error getting outgoing payment by hash:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
