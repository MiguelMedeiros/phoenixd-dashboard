import { Router, Response } from 'express';
import { phoenixd } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const nodeRouter = Router();

// Get Node Info
nodeRouter.get('/info', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await phoenixd.getInfo();
    res.json(result);
  } catch (error) {
    console.error('Error getting node info:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Balance
nodeRouter.get('/balance', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await phoenixd.getBalance();
    res.json(result);
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// List Channels
nodeRouter.get('/channels', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await phoenixd.listChannels();
    res.json(result);
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Close Channel
nodeRouter.post(
  '/channels/close',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { channelId, address, feerateSatByte } = req.body;
      const result = await phoenixd.closeChannel({
        channelId,
        address,
        feerateSatByte: parseInt(feerateSatByte),
      });
      res.json({ txId: result });
    } catch (error) {
      console.error('Error closing channel:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Estimate Liquidity Fees
nodeRouter.get('/estimatefees', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amountSat } = req.query;
    if (!amountSat) {
      return res.status(400).json({ error: 'amountSat is required' });
    }
    const result = await phoenixd.estimateLiquidityFees(parseInt(amountSat as string));
    res.json(result);
  } catch (error) {
    console.error('Error estimating liquidity fees:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
