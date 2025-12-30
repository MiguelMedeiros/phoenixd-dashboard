import { Router, Request, Response } from 'express';
import { phoenixd } from '../index.js';

export const phoenixdRouter = Router();

// Create Bolt11 Invoice
phoenixdRouter.post('/createinvoice', async (req: Request, res: Response) => {
  try {
    const { description, descriptionHash, amountSat, expirySeconds, externalId, webhookUrl } =
      req.body;
    // phoenixd requires either description or descriptionHash
    const desc = description || descriptionHash ? undefined : 'Phoenixd Dashboard Payment';
    const result = await phoenixd.createInvoice({
      description: description || desc,
      descriptionHash,
      amountSat: amountSat ? parseInt(amountSat) : undefined,
      expirySeconds: expirySeconds ? parseInt(expirySeconds) : undefined,
      externalId,
      webhookUrl,
    });
    res.json(result);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create Bolt12 Offer
phoenixdRouter.post('/createoffer', async (req: Request, res: Response) => {
  try {
    const { description, amountSat } = req.body;
    const result = await phoenixd.createOffer({
      description,
      amountSat: amountSat ? parseInt(amountSat) : undefined,
    });
    res.json({ offer: result });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get Lightning Address
phoenixdRouter.get('/getlnaddress', async (_req: Request, res: Response) => {
  try {
    const result = await phoenixd.getLnAddress();
    res.json({ address: result });
  } catch (error) {
    console.error('Error getting LN address:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Pay Bolt11 Invoice
phoenixdRouter.post('/payinvoice', async (req: Request, res: Response) => {
  try {
    const { invoice, amountSat } = req.body;
    const result = (await phoenixd.payInvoice({
      invoice,
      amountSat: amountSat ? parseInt(amountSat) : undefined,
    })) as { reason?: string; paymentPreimage?: string };

    // Check if payment actually succeeded (phoenixd returns 200 even on failure)
    if (result.reason) {
      throw new Error(result.reason);
    }

    res.json(result);
  } catch (error) {
    console.error('Error paying invoice:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Pay Bolt12 Offer
phoenixdRouter.post('/payoffer', async (req: Request, res: Response) => {
  try {
    const { offer, amountSat, message } = req.body;
    const result = (await phoenixd.payOffer({
      offer,
      amountSat: parseInt(amountSat),
      message,
    })) as { reason?: string; paymentPreimage?: string };

    // Check if payment actually succeeded (phoenixd returns 200 even on failure)
    if (result.reason) {
      throw new Error(result.reason);
    }

    res.json(result);
  } catch (error) {
    console.error('Error paying offer:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Pay Lightning Address (with fallback to manual LNURL resolution)
phoenixdRouter.post('/paylnaddress', async (req: Request, res: Response) => {
  try {
    const { address, amountSat, message } = req.body;
    const amount = parseInt(amountSat);

    // Try phoenixd's native paylnaddress first
    try {
      const result = (await phoenixd.payLnAddress({
        address,
        amountSat: amount,
        message,
      })) as { reason?: string; paymentPreimage?: string };

      // Check if payment actually succeeded (phoenixd returns 200 even on failure)
      if (result.reason) {
        throw new Error(result.reason);
      }

      res.json(result);
      return;
    } catch (phoenixdError) {
      const errorMessage = (phoenixdError as Error).message;
      // If it's a network/DNS error from phoenixd connecting to the LN address domain,
      // try manual resolution. For other errors (including payment failures), throw immediately.
      const isNetworkError =
        errorMessage.includes('could not connect') || errorMessage.includes('cannot resolve');

      if (isNetworkError) {
        console.log('Phoenixd cannot resolve address, trying manual LNURL resolution...');
      } else {
        // For payment failures and other errors, throw immediately
        throw phoenixdError;
      }
    }

    // Manual LNURL resolution as fallback
    // Parse Lightning Address (user@domain.com -> https://domain.com/.well-known/lnurlp/user)
    const [user, domain] = address.split('@');
    if (!user || !domain) {
      throw new Error('Invalid Lightning Address format');
    }

    // Fetch LNURL metadata
    const lnurlUrl = `https://${domain}/.well-known/lnurlp/${user}`;
    console.log(`Fetching LNURL from: ${lnurlUrl}`);
    const lnurlResponse = await fetch(lnurlUrl);
    if (!lnurlResponse.ok) {
      throw new Error(`Failed to fetch LNURL: ${lnurlResponse.status}`);
    }

    const lnurlData = (await lnurlResponse.json()) as {
      status?: string;
      tag?: string;
      callback?: string;
      minSendable?: number;
      maxSendable?: number;
      commentAllowed?: number;
    };

    if (lnurlData.status === 'ERROR') {
      throw new Error(`LNURL error: ${JSON.stringify(lnurlData)}`);
    }

    if (lnurlData.tag !== 'payRequest') {
      throw new Error('Not a valid LNURL-pay endpoint');
    }

    // Check amount bounds (LNURL uses millisats)
    const amountMsat = amount * 1000;
    if (lnurlData.minSendable && amountMsat < lnurlData.minSendable) {
      throw new Error(`Amount too low. Minimum: ${lnurlData.minSendable / 1000} sats`);
    }
    if (lnurlData.maxSendable && amountMsat > lnurlData.maxSendable) {
      throw new Error(`Amount too high. Maximum: ${lnurlData.maxSendable / 1000} sats`);
    }

    // Request invoice from callback
    const callbackUrl = new URL(lnurlData.callback!);
    callbackUrl.searchParams.set('amount', amountMsat.toString());
    if (message && lnurlData.commentAllowed && message.length <= lnurlData.commentAllowed) {
      callbackUrl.searchParams.set('comment', message);
    }

    console.log(`Requesting invoice from: ${callbackUrl.toString()}`);
    const invoiceResponse = await fetch(callbackUrl.toString());
    if (!invoiceResponse.ok) {
      throw new Error(`Failed to get invoice: ${invoiceResponse.status}`);
    }

    const invoiceData = (await invoiceResponse.json()) as {
      status?: string;
      pr?: string;
      routes?: unknown[];
    };

    if (invoiceData.status === 'ERROR' || !invoiceData.pr) {
      throw new Error(`Failed to get invoice: ${JSON.stringify(invoiceData)}`);
    }

    // Pay the invoice using phoenixd
    console.log('Paying invoice via phoenixd...');
    const result = (await phoenixd.payInvoice({
      invoice: invoiceData.pr,
    })) as { reason?: string; paymentPreimage?: string };

    // Check if payment actually succeeded (phoenixd returns 200 even on failure)
    if (result.reason) {
      throw new Error(result.reason);
    }

    res.json(result);
  } catch (error) {
    console.error('Error paying LN address:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Send to On-chain Address
phoenixdRouter.post('/sendtoaddress', async (req: Request, res: Response) => {
  try {
    const { address, amountSat, feerateSatByte } = req.body;
    const result = await phoenixd.sendToAddress({
      address,
      amountSat: parseInt(amountSat),
      feerateSatByte: parseInt(feerateSatByte),
    });
    res.json({ txId: result });
  } catch (error) {
    console.error('Error sending to address:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bump Fee
phoenixdRouter.post('/bumpfee', async (req: Request, res: Response) => {
  try {
    const { feerateSatByte } = req.body;
    const result = await phoenixd.bumpFee(parseInt(feerateSatByte));
    res.json({ txId: result });
  } catch (error) {
    console.error('Error bumping fee:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Decode Invoice
phoenixdRouter.post('/decodeinvoice', async (req: Request, res: Response) => {
  try {
    const { invoice } = req.body;
    const result = await phoenixd.decodeInvoice(invoice);
    res.json(result);
  } catch (error) {
    console.error('Error decoding invoice:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Decode Offer
phoenixdRouter.post('/decodeoffer', async (req: Request, res: Response) => {
  try {
    const { offer } = req.body;
    const result = await phoenixd.decodeOffer(offer);
    res.json(result);
  } catch (error) {
    console.error('Error decoding offer:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Export CSV
phoenixdRouter.post('/export', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body;
    const result = await phoenixd.exportCsv(
      from ? parseInt(from) : undefined,
      to ? parseInt(to) : undefined
    );
    res.json({ message: result });
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
