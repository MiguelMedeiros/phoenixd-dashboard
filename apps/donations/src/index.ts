import express, { Request, Response } from 'express';
import QRCode from 'qrcode';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Environment variables (injected by Phoenixd Dashboard)
const DASHBOARD_URL = process.env.PHOENIXD_DASHBOARD_URL || 'http://localhost:4000';
const API_KEY = process.env.PHOENIXD_APP_API_KEY || '';
const WEBHOOK_SECRET = process.env.PHOENIXD_WEBHOOK_SECRET || '';
const NODE_ID = process.env.PHOENIXD_NODE_ID || '';
const CHAIN = process.env.PHOENIXD_CHAIN || 'mainnet';

// Custom configuration via environment variables
const PAGE_TITLE = process.env.DONATIONS_TITLE || 'Support Our Project';
const PAGE_SUBTITLE = process.env.DONATIONS_SUBTITLE || 'Your contribution helps us keep building amazing things';
const PAGE_LOGO = process.env.DONATIONS_LOGO || '';
const PAGE_THEME = process.env.DONATIONS_THEME || 'dark'; // 'dark' or 'light'
const SUGGESTED_AMOUNTS = process.env.DONATIONS_AMOUNTS || '1000,5000,10000,50000'; // sats
const SUCCESS_MESSAGE = process.env.DONATIONS_SUCCESS_MESSAGE || 'Thank you for your generous donation! ⚡';
const CURRENCY = process.env.DONATIONS_CURRENCY || 'sats';

// In-memory storage for pending invoices (in production, use a proper database)
const pendingInvoices = new Map<string, {
  paymentHash: string;
  amountSat: number;
  description: string;
  createdAt: number;
  status: 'pending' | 'paid' | 'expired';
  donorName?: string;
  donorMessage?: string;
}>();

// Recent donations for display
const recentDonations: Array<{
  amountSat: number;
  donorName: string;
  message?: string;
  timestamp: number;
}> = [];

// BOLT12 offer (created on startup)
let bolt12Offer: string | null = null;
let bolt12OfferQr: string | null = null;

/**
 * Create BOLT12 offer on startup
 */
async function initializeBolt12Offer(): Promise<void> {
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/apps-gateway/offers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: `${PAGE_TITLE} - Lightning Donations`,
        // No amount = any amount offer
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create BOLT12 offer:', error);
      return;
    }

    const result = await response.json();
    // API may return offer directly or as { offer: string }
    const offer = (typeof result === 'string' ? result : result.offer) as string;
    if (!offer) {
      console.error('No offer in response:', result);
      return;
    }
    bolt12Offer = offer;
    
    // Generate QR code for offer
    bolt12OfferQr = await QRCode.toDataURL(offer.toUpperCase(), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: PAGE_THEME === 'dark' ? '#ffffff' : '#000000',
        light: '#00000000',
      },
    });
    
    console.log(`🎫 BOLT12 Offer created: ${offer.substring(0, 30)}...`);
  } catch (error) {
    console.error('Error creating BOLT12 offer:', error);
  }
}

// Clean up expired invoices periodically
setInterval(() => {
  const now = Date.now();
  const expiryTime = 60 * 60 * 1000; // 1 hour
  for (const [hash, invoice] of pendingInvoices.entries()) {
    if (invoice.status === 'pending' && now - invoice.createdAt > expiryTime) {
      pendingInvoices.set(hash, { ...invoice, status: 'expired' });
    }
  }
}, 60000);

/**
 * Verify webhook signature
 */
function verifySignature(payload: object, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true; // Skip if no secret configured
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Create invoice via Dashboard API
 */
async function createInvoice(amountSat: number, description: string, externalId?: string): Promise<{
  serialized: string;
  paymentHash: string;
}> {
  const response = await fetch(`${DASHBOARD_URL}/api/apps-gateway/invoices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amountSat,
      description,
      expirySeconds: 3600,
      externalId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create invoice');
  }

  return response.json();
}

// ============================================
// ROUTES
// ============================================

/**
 * Health check endpoint (required by Dashboard)
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'phoenixd-donations', version: '1.0.0' });
});

/**
 * Get configuration
 */
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    title: PAGE_TITLE,
    subtitle: PAGE_SUBTITLE,
    logo: PAGE_LOGO,
    theme: PAGE_THEME,
    suggestedAmounts: SUGGESTED_AMOUNTS.split(',').map(Number),
    successMessage: SUCCESS_MESSAGE,
    currency: CURRENCY,
    nodeId: NODE_ID,
    chain: CHAIN,
    bolt12: bolt12Offer ? {
      offer: bolt12Offer,
      qrCode: bolt12OfferQr,
    } : null,
  });
});

/**
 * Get recent donations
 */
app.get('/api/donations/recent', (_req: Request, res: Response) => {
  res.json(recentDonations.slice(0, 10));
});

/**
 * Create a donation invoice
 */
app.post('/api/donations/create', async (req: Request, res: Response) => {
  try {
    const { amountSat, donorName, message } = req.body;

    if (!amountSat || amountSat < 1) {
      res.status(400).json({ error: 'Amount must be at least 1 sat' });
      return;
    }

    const description = message 
      ? `Donation from ${donorName || 'Anonymous'}: ${message}`
      : `Donation from ${donorName || 'Anonymous'}`;

    const externalId = `donation-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const invoice = await createInvoice(amountSat, description, externalId);

    // Store pending invoice
    pendingInvoices.set(invoice.paymentHash, {
      paymentHash: invoice.paymentHash,
      amountSat,
      description,
      createdAt: Date.now(),
      status: 'pending',
      donorName: donorName || 'Anonymous',
      donorMessage: message,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(invoice.serialized.toUpperCase(), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: PAGE_THEME === 'dark' ? '#ffffff' : '#000000',
        light: '#00000000',
      },
    });

    res.json({
      paymentHash: invoice.paymentHash,
      invoice: invoice.serialized,
      qrCode,
      amountSat,
    });
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Check donation status
 */
app.get('/api/donations/status/:paymentHash', (req: Request, res: Response) => {
  const { paymentHash } = req.params;
  const invoice = pendingInvoices.get(paymentHash);

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  res.json({
    paymentHash: invoice.paymentHash,
    amountSat: invoice.amountSat,
    status: invoice.status,
    donorName: invoice.donorName,
  });
});

/**
 * Webhook endpoint for payment notifications
 */
app.post('/webhook', (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string;
  
  // Verify signature
  if (!verifySignature(req.body, signature)) {
    console.error('Invalid webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const { event, data } = req.body;
  console.log(`Received webhook: ${event}`, data);

  if (event === 'payment_received') {
    const invoice = pendingInvoices.get(data.paymentHash);
    
    if (invoice) {
      // Update invoice status
      pendingInvoices.set(data.paymentHash, { ...invoice, status: 'paid' });

      // Add to recent donations
      recentDonations.unshift({
        amountSat: invoice.amountSat,
        donorName: invoice.donorName || 'Anonymous',
        message: invoice.donorMessage,
        timestamp: Date.now(),
      });

      // Keep only last 100 donations
      if (recentDonations.length > 100) {
        recentDonations.pop();
      }

      console.log(`✅ Donation received: ${invoice.amountSat} sats from ${invoice.donorName}`);
    }
  }

  res.json({ received: true });
});

/**
 * Serve the donation page
 */
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`⚡ Phoenixd Donations app running on port ${PORT}`);
  console.log(`📍 Dashboard URL: ${DASHBOARD_URL}`);
  console.log(`🔑 API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
  console.log(`🎨 Theme: ${PAGE_THEME}`);
  console.log(`💰 Suggested amounts: ${SUGGESTED_AMOUNTS} sats`);
  
  // Initialize BOLT12 offer
  if (API_KEY) {
    await initializeBolt12Offer();
  }
});
