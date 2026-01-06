import { Router, Response } from 'express';
import { phoenixd } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const lnurlRouter = Router();

// LNURL Pay
lnurlRouter.post('/pay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lnurl, amountSat, message } = req.body;
    const result = await phoenixd.lnurlPay(lnurl, parseInt(amountSat), message);
    res.json(result);
  } catch (error) {
    console.error('Error LNURL pay:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// LNURL Withdraw
lnurlRouter.post('/withdraw', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lnurl } = req.body;
    const result = await phoenixd.lnurlWithdraw(lnurl);
    res.json(result);
  } catch (error) {
    console.error('Error LNURL withdraw:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// LNURL Auth
lnurlRouter.post('/auth', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lnurl } = req.body;
    const result = await phoenixd.lnurlAuth(lnurl);
    res.json({ message: result });
  } catch (error) {
    console.error('Error LNURL auth:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
