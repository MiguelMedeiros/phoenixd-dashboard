import crypto from 'crypto';
import { App } from '@prisma/client';
import { prisma } from '../index.js';
import { AppDockerService } from './app-docker.js';

const appDocker = new AppDockerService();

// Webhook event types
export type WebhookEventType =
  | 'payment_received'
  | 'payment_sent'
  | 'channel_opened'
  | 'channel_closed';

// Webhook payload structure
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: number;
  data: unknown;
  signature?: string;
}

// Payment received event data
export interface PaymentReceivedData {
  paymentHash: string;
  amountSat: number;
  description?: string;
  externalId?: string;
  receivedAt: number;
  payerKey?: string;
  payerNote?: string;
}

// Payment sent event data
export interface PaymentSentData {
  paymentId: string;
  paymentHash: string;
  amountSat: number;
  feesSat: number;
  destination?: string;
  sentAt: number;
}

// Channel event data
export interface ChannelEventData {
  channelId: string;
  capacitySat: number;
  fundingTxId?: string;
  timestamp: number;
}

/**
 * Sign a webhook payload with HMAC-SHA256
 */
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Dispatch a webhook event to all subscribed apps
 */
export async function dispatchWebhook(eventType: WebhookEventType, data: unknown): Promise<void> {
  console.log(`[Webhooks] Dispatching event: ${eventType}`);

  // Find apps that subscribe to this event and are enabled/running
  const apps = await prisma.app.findMany({
    where: {
      isEnabled: true,
      containerStatus: 'running',
    },
  });

  // Filter apps that subscribe to this event
  const subscribedApps = apps.filter((app) => {
    if (!app.webhookEvents) return false;
    try {
      const events = JSON.parse(app.webhookEvents) as string[];
      return events.includes(eventType);
    } catch {
      return false;
    }
  });

  if (subscribedApps.length === 0) {
    console.log(`[Webhooks] No apps subscribed to ${eventType}`);
    return;
  }

  console.log(`[Webhooks] Sending ${eventType} to ${subscribedApps.length} apps`);

  // Send webhook to each subscribed app in parallel
  const results = await Promise.allSettled(
    subscribedApps.map((app) => sendWebhookToApp(app, eventType, data))
  );

  // Log results
  results.forEach((result, index) => {
    const app = subscribedApps[index];
    if (result.status === 'fulfilled') {
      console.log(`[Webhooks] Successfully sent ${eventType} to ${app.slug}`);
    } else {
      console.error(`[Webhooks] Failed to send ${eventType} to ${app.slug}:`, result.reason);
    }
  });
}

/**
 * Send a webhook to a specific app
 */
async function sendWebhookToApp(
  app: App,
  eventType: WebhookEventType,
  data: unknown
): Promise<void> {
  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    // Build the webhook URL
    const baseUrl = appDocker.getAppInternalUrl(app);
    const webhookUrl = `${baseUrl}${app.webhookPath || '/webhook'}`;

    // Build the payload
    const payload: WebhookPayload = {
      event: eventType,
      timestamp: Date.now(),
      data,
    };

    const payloadString = JSON.stringify(payload);

    // Sign the payload if we have a secret
    let signature: string | undefined;
    if (app.webhookSecret) {
      signature = signPayload(payloadString, app.webhookSecret);
    }

    // Set up request with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Send the webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': eventType,
        'X-Webhook-Timestamp': payload.timestamp.toString(),
        ...(signature && { 'X-Webhook-Signature': signature }),
        ...(app.apiKey && { 'X-App-Id': app.slug }),
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    statusCode = response.status;
    success = response.ok;

    // Try to get response body (truncated)
    try {
      const text = await response.text();
      responseBody = text.substring(0, 500); // Truncate to 500 chars
    } catch {
      responseBody = null;
    }
  } catch (error) {
    success = false;
    responseBody = error instanceof Error ? error.message : 'Unknown error';
  }

  const latencyMs = Date.now() - startTime;

  // Log the webhook attempt
  try {
    await prisma.appWebhookLog.create({
      data: {
        appId: app.id,
        eventType,
        payload: JSON.stringify(data),
        statusCode,
        response: responseBody,
        success,
        latencyMs,
      },
    });
  } catch (logError) {
    console.error(`[Webhooks] Failed to log webhook for ${app.slug}:`, logError);
  }

  if (!success) {
    throw new Error(`Webhook failed with status ${statusCode}: ${responseBody}`);
  }
}

/**
 * Dispatch payment_received event
 */
export async function dispatchPaymentReceived(data: PaymentReceivedData): Promise<void> {
  await dispatchWebhook('payment_received', data);
}

/**
 * Dispatch payment_sent event
 */
export async function dispatchPaymentSent(data: PaymentSentData): Promise<void> {
  await dispatchWebhook('payment_sent', data);
}

/**
 * Dispatch channel_opened event
 */
export async function dispatchChannelOpened(data: ChannelEventData): Promise<void> {
  await dispatchWebhook('channel_opened', data);
}

/**
 * Dispatch channel_closed event
 */
export async function dispatchChannelClosed(data: ChannelEventData): Promise<void> {
  await dispatchWebhook('channel_closed', data);
}

/**
 * Clean up old webhook logs (keep last 30 days)
 */
export async function cleanupOldWebhookLogs(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await prisma.appWebhookLog.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  console.log(`[Webhooks] Cleaned up ${result.count} old webhook logs`);
  return result.count;
}

/**
 * Get webhook stats for an app
 */
export async function getWebhookStats(appId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  avgLatencyMs: number;
  lastWebhook: Date | null;
}> {
  const logs = await prisma.appWebhookLog.findMany({
    where: { appId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (logs.length === 0) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      avgLatencyMs: 0,
      lastWebhook: null,
    };
  }

  const successful = logs.filter((l) => l.success).length;
  const avgLatencyMs = logs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / logs.length;

  return {
    total: logs.length,
    successful,
    failed: logs.length - successful,
    avgLatencyMs: Math.round(avgLatencyMs),
    lastWebhook: logs[0].createdAt,
  };
}

/**
 * Test webhook delivery to an app
 */
export async function testWebhook(appId: string): Promise<{
  success: boolean;
  statusCode: number | null;
  latencyMs: number;
  error?: string;
}> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) {
    return { success: false, statusCode: null, latencyMs: 0, error: 'App not found' };
  }

  if (app.containerStatus !== 'running') {
    return { success: false, statusCode: null, latencyMs: 0, error: 'App is not running' };
  }

  const startTime = Date.now();
  let statusCode: number | null = null;

  try {
    const baseUrl = appDocker.getAppInternalUrl(app);
    const webhookUrl = `${baseUrl}${app.webhookPath || '/webhook'}`;

    const testPayload = {
      event: 'test',
      timestamp: Date.now(),
      data: { message: 'This is a test webhook from Phoenixd Dashboard' },
    };

    const payloadString = JSON.stringify(testPayload);
    const signature = app.webhookSecret ? signPayload(payloadString, app.webhookSecret) : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'test',
        'X-Webhook-Timestamp': testPayload.timestamp.toString(),
        ...(signature && { 'X-Webhook-Signature': signature }),
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;

    return {
      success: response.ok,
      statusCode,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      statusCode,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
