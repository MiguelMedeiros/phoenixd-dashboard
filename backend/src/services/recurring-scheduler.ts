import { prisma, phoenixd, broadcastPayment } from '../index.js';
import { calculateNextRunAt } from '../routes/recurring-payments.js';

type RecurringPaymentFrequency =
  | 'every_minute'
  | 'every_5_minutes'
  | 'every_15_minutes'
  | 'every_30_minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly';

/**
 * Pay Lightning Address with fallback to manual LNURL resolution
 * (same logic as backend route /api/phoenixd/paylnaddress)
 */
async function payLnAddressWithFallback(params: {
  address: string;
  amountSat: number;
  message?: string;
}): Promise<{
  recipientAmountSat: number;
  routingFeeSat: number;
  paymentId: string;
  paymentHash: string;
  paymentPreimage: string;
}> {
  const { address, amountSat, message } = params;

  // Try phoenixd's native paylnaddress first
  try {
    const result = (await phoenixd.payLnAddress({
      address,
      amountSat,
      message,
    })) as {
      reason?: string;
      recipientAmountSat: number;
      routingFeeSat: number;
      paymentId: string;
      paymentHash: string;
      paymentPreimage: string;
    };

    // Check if payment actually succeeded (phoenixd returns 200 even on failure)
    if (result.reason) {
      throw new Error(result.reason);
    }

    return {
      recipientAmountSat: result.recipientAmountSat,
      routingFeeSat: result.routingFeeSat,
      paymentId: result.paymentId,
      paymentHash: result.paymentHash,
      paymentPreimage: result.paymentPreimage,
    };
  } catch (phoenixdError) {
    const errorMessage = (phoenixdError as Error).message;
    // If it's a network/DNS error from phoenixd connecting to the LN address domain,
    // try manual resolution. For other errors (including payment failures), throw immediately.
    const isNetworkError =
      errorMessage.includes('could not connect') || errorMessage.includes('cannot resolve');

    if (!isNetworkError) {
      throw phoenixdError;
    }

    console.log('[Recurring] Phoenixd cannot resolve address, trying manual LNURL resolution...');
  }

  // Manual LNURL resolution as fallback
  // Parse Lightning Address (user@domain.com -> https://domain.com/.well-known/lnurlp/user)
  const [user, domain] = address.split('@');
  if (!user || !domain) {
    throw new Error('Invalid Lightning Address format');
  }

  // Fetch LNURL metadata
  const lnurlUrl = `https://${domain}/.well-known/lnurlp/${user}`;
  console.log(`[Recurring] Fetching LNURL from: ${lnurlUrl}`);
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
  const amountMsat = amountSat * 1000;
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

  console.log(`[Recurring] Requesting invoice from: ${callbackUrl.toString()}`);
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
    throw new Error('Failed to get invoice from Lightning Address');
  }

  // Pay the invoice using phoenixd
  console.log(`[Recurring] Paying invoice via manual LNURL resolution`);
  const payResult = await phoenixd.payInvoice({
    invoice: invoiceData.pr,
  });

  return {
    recipientAmountSat: payResult.recipientAmountSat,
    routingFeeSat: payResult.routingFeeSat,
    paymentId: payResult.paymentId,
    paymentHash: payResult.paymentHash,
    paymentPreimage: payResult.paymentPreimage,
  };
}

interface RecurringPaymentWithContact {
  id: string;
  contactId: string;
  addressId: string;
  connectionId: string | null;
  amountSat: number;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  note: string | null;
  categoryId: string | null;
  status: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  totalPaid: number;
  paymentCount: number;
  contact: {
    id: string;
    name: string;
    addresses: Array<{
      id: string;
      address: string;
      type: string;
    }>;
  };
  connection?: {
    id: string;
    name: string;
  } | null;
}

interface ExecutionResult {
  success: boolean;
  paymentId?: string;
  paymentHash?: string;
  amountSat?: number;
  error?: string;
}

/**
 * Execute a single recurring payment
 */
export async function executeRecurringPayment(
  recurringPayment: RecurringPaymentWithContact
): Promise<ExecutionResult> {
  const { id, addressId, amountSat, note, categoryId, contact } = recurringPayment;

  // Find the address to use
  const address = contact.addresses.find((a) => a.id === addressId);
  if (!address) {
    const errorMessage = 'Address not found on contact';

    // Record failed execution
    await prisma.recurringPaymentExecution.create({
      data: {
        recurringPaymentId: id,
        status: 'failed',
        amountSat,
        errorMessage,
      },
    });

    // Update recurring payment with error
    await prisma.recurringPayment.update({
      where: { id },
      data: { lastError: errorMessage },
    });

    return { success: false, error: errorMessage };
  }

  try {
    let paymentResult: {
      paymentId: string;
      paymentHash: string;
      recipientAmountSat: number;
    };

    // Execute payment based on address type
    if (address.type === 'lightning_address') {
      // Use fallback function that tries manual LNURL resolution if phoenixd can't resolve
      paymentResult = await payLnAddressWithFallback({
        address: address.address,
        amountSat,
        message: note || `Recurring payment to ${contact.name}`,
      });
    } else if (address.type === 'bolt12_offer') {
      const offerResult = (await phoenixd.payOffer({
        offer: address.address,
        amountSat,
        message: note || `Recurring payment to ${contact.name}`,
      })) as {
        reason?: string;
        paymentId: string;
        paymentHash: string;
        recipientAmountSat: number;
      };

      // Check if payment actually succeeded (phoenixd returns 200 even on failure)
      if (offerResult.reason) {
        throw new Error(offerResult.reason);
      }

      if (!offerResult.paymentId) {
        throw new Error('Payment succeeded but no paymentId returned');
      }

      paymentResult = offerResult;
    } else {
      throw new Error(`Unsupported address type: ${address.type}`);
    }

    // Record successful execution
    await prisma.recurringPaymentExecution.create({
      data: {
        recurringPaymentId: id,
        status: 'success',
        amountSat,
        paymentId: paymentResult.paymentId,
        paymentHash: paymentResult.paymentHash,
      },
    });

    // Calculate next run date
    const nextRunAt = calculateNextRunAt(
      recurringPayment.frequency as RecurringPaymentFrequency,
      recurringPayment.timeOfDay,
      recurringPayment.dayOfWeek,
      recurringPayment.dayOfMonth,
      new Date()
    );

    // Update recurring payment stats
    await prisma.recurringPayment.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        lastError: null,
        totalPaid: { increment: amountSat },
        paymentCount: { increment: 1 },
        nextRunAt,
      },
    });

    // Create payment metadata to link with contact (only if we have a valid paymentId)
    if (paymentResult.paymentId) {
      const metadata = await prisma.paymentMetadata.upsert({
        where: { paymentId: paymentResult.paymentId },
        create: {
          paymentId: paymentResult.paymentId,
          contactId: contact.id,
          note: note || `Recurring payment to ${contact.name}`,
        },
        update: {
          contactId: contact.id,
          note: note || `Recurring payment to ${contact.name}`,
        },
      });

      // Add category if provided using junction table
      if (categoryId) {
        await prisma.paymentCategoryOnPayment.upsert({
          where: {
            paymentMetadataId_categoryId: {
              paymentMetadataId: metadata.id,
              categoryId,
            },
          },
          create: {
            paymentMetadataId: metadata.id,
            categoryId,
          },
          update: {},
        });
      }
    } else {
      console.warn(`[Recurring] Payment succeeded but no paymentId to create metadata`);
    }

    console.log(
      `[Recurring] Payment executed successfully: ${amountSat} sats to ${contact.name} (${paymentResult.paymentId})`
    );

    // Broadcast recurring payment executed event to all connected clients
    broadcastPayment({
      type: 'recurring_payment_executed',
      recurringPaymentId: id,
      contactId: contact.id,
      contactName: contact.name,
      amountSat,
      paymentId: paymentResult.paymentId,
      paymentHash: paymentResult.paymentHash,
      timestamp: Date.now(),
    });

    return {
      success: true,
      paymentId: paymentResult.paymentId,
      paymentHash: paymentResult.paymentHash,
      amountSat,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Record failed execution
    await prisma.recurringPaymentExecution.create({
      data: {
        recurringPaymentId: id,
        status: 'failed',
        amountSat,
        errorMessage,
      },
    });

    // Calculate next run date (still schedule next even after failure)
    const nextRunAt = calculateNextRunAt(
      recurringPayment.frequency as RecurringPaymentFrequency,
      recurringPayment.timeOfDay,
      recurringPayment.dayOfWeek,
      recurringPayment.dayOfMonth,
      new Date()
    );

    // Update recurring payment with error
    await prisma.recurringPayment.update({
      where: { id },
      data: {
        lastError: errorMessage,
        nextRunAt,
      },
    });

    console.error(`[Recurring] Payment failed for ${contact.name}: ${errorMessage}`);

    return { success: false, error: errorMessage };
  }
}

/**
 * Check and execute all due recurring payments
 * Only processes payments tied to the currently active connection
 */
export async function processDuePayments(): Promise<void> {
  const now = new Date();

  try {
    // Get the active connection
    const activeConnection = await prisma.phoenixdConnection.findFirst({
      where: { isActive: true },
    });

    if (!activeConnection) {
      console.log('[Recurring] No active connection, skipping payment processing');
      return;
    }

    // Find all active recurring payments that are due AND tied to the active connection
    // Also include legacy payments (connectionId = null) for backwards compatibility
    const duePayments = await prisma.recurringPayment.findMany({
      where: {
        status: 'active',
        nextRunAt: {
          lte: now,
        },
        OR: [
          { connectionId: activeConnection.id },
          { connectionId: null }, // Legacy payments without connection
        ],
      },
      include: {
        contact: {
          include: {
            addresses: true,
          },
        },
        connection: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (duePayments.length === 0) {
      return;
    }

    console.log(
      `[Recurring] Processing ${duePayments.length} due payment(s) for connection: ${activeConnection.name}`
    );

    // Execute each payment sequentially to avoid overwhelming the node
    for (const payment of duePayments) {
      try {
        console.log(
          `[Recurring] Executing payment ${payment.id} for ${payment.contact.name} (${payment.amountSat} sats) via ${payment.connection?.name || 'legacy'}`
        );
        const result = await executeRecurringPayment(payment);
        if (result.success) {
          console.log(
            `[Recurring] Payment executed successfully: ${payment.amountSat} sats to ${payment.contact.name} (${payment.id})`
          );
        } else {
          console.log(`[Recurring] Payment failed for ${payment.contact.name}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[Recurring] Error executing payment ${payment.id}:`, err);
      }

      // Small delay between payments to be gentle on the node
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('[Recurring] Error processing due payments:', error);
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the recurring payment scheduler
 */
export function startRecurringPaymentScheduler(intervalMs: number = 60000): void {
  if (schedulerInterval) {
    console.log('[Recurring] Scheduler already running');
    return;
  }

  console.log(`[Recurring] Starting scheduler (checking every ${intervalMs / 1000}s)`);

  // Run immediately on start
  processDuePayments().catch(console.error);

  // Then run at the specified interval
  schedulerInterval = setInterval(() => {
    processDuePayments().catch(console.error);
  }, intervalMs);
}

/**
 * Stop the recurring payment scheduler
 */
export function stopRecurringPaymentScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Recurring] Scheduler stopped');
  }
}
