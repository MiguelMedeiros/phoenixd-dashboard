const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Types
export interface Channel {
  state: string;
  channelId: string;
  balanceSat: number;
  inboundLiquiditySat: number;
  capacitySat: number;
  fundingTxId: string;
}

export interface IncomingPayment {
  type: string;
  subType: string;
  paymentHash: string;
  preimage?: string;
  description?: string;
  invoice?: string;
  isPaid: boolean;
  isExpired?: boolean;
  requestedSat?: number;
  receivedSat: number;
  fees: number;
  expiresAt?: number;
  completedAt?: number;
  createdAt: number;
  payerKey?: string;
  payerNote?: string;
  externalId?: string;
}

export interface OutgoingPayment {
  type: string;
  subType: string;
  paymentId: string;
  paymentHash?: string;
  txId?: string;
  preimage?: string;
  isPaid: boolean;
  sent: number;
  /** Fees in millisatoshis (msat) - divide by 1000 to get satoshis */
  fees: number;
  invoice?: string;
  completedAt?: number;
  createdAt: number;
}

// Node Management
export async function getNodeInfo() {
  return request<{
    nodeId: string;
    chain: string;
    version: string;
    channels: Channel[];
  }>('/api/node/info');
}

export async function getBalance() {
  return request<{
    balanceSat: number;
    feeCreditSat: number;
  }>('/api/node/balance');
}

export async function listChannels(): Promise<Channel[]> {
  return request<Channel[]>('/api/node/channels');
}

export async function closeChannel(params: {
  channelId: string;
  address?: string;
  feerateSatByte?: number;
}) {
  return request<{ txId: string }>('/api/node/channels/close', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function estimateLiquidityFees(params: { amountSat: number }) {
  return request<{
    miningFeeSat: number;
    serviceFeeSat: number;
  }>(`/api/node/estimatefees?amountSat=${params.amountSat}`);
}

// Payments - Create
export async function createInvoice(params: {
  description?: string;
  amountSat?: number;
  expirySeconds?: number;
  externalId?: string;
}) {
  return request<{
    amountSat: number;
    paymentHash: string;
    serialized: string;
  }>('/api/phoenixd/createinvoice', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createOffer(params: { description?: string; amountSat?: number }) {
  return request<{ offer: string }>('/api/phoenixd/createoffer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getLnAddress() {
  return request<{ lnaddress: string }>('/api/phoenixd/getlnaddress');
}

// Payments - Pay
export async function payInvoice(params: { invoice: string; amountSat?: number }) {
  return request<{
    recipientAmountSat: number;
    routingFeeSat: number;
    paymentId: string;
    paymentHash: string;
    paymentPreimage: string;
  }>('/api/phoenixd/payinvoice', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function payOffer(params: { offer: string; amountSat: number; message?: string }) {
  return request<{
    recipientAmountSat: number;
    routingFeeSat: number;
    paymentId: string;
    paymentHash: string;
    paymentPreimage: string;
  }>('/api/phoenixd/payoffer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function payLnAddress(params: {
  address: string;
  amountSat: number;
  message?: string;
}) {
  return request<{
    recipientAmountSat: number;
    routingFeeSat: number;
    paymentId: string;
    paymentHash: string;
    paymentPreimage: string;
  }>('/api/phoenixd/paylnaddress', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function sendToAddress(params: {
  address: string;
  amountSat: number;
  feerateSatByte?: number;
}) {
  return request<{ txId: string }>('/api/phoenixd/sendtoaddress', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function bumpFee(feerateSatByte: number) {
  return request<{ txId: string }>('/api/phoenixd/bumpfee', {
    method: 'POST',
    body: JSON.stringify({ feerateSatByte }),
  });
}

// Payments - List
export async function getIncomingPayments(params?: {
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
  all?: boolean;
  externalId?: string;
}): Promise<IncomingPayment[]> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
  }
  const query = queryParams.toString();
  return request<IncomingPayment[]>(`/api/payments/incoming${query ? `?${query}` : ''}`);
}

export async function getIncomingPayment(paymentHash: string) {
  return request<IncomingPayment>(`/api/payments/incoming/${paymentHash}`);
}

export async function getOutgoingPayments(params?: {
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
  all?: boolean;
}): Promise<OutgoingPayment[]> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
  }
  const query = queryParams.toString();
  return request<OutgoingPayment[]>(`/api/payments/outgoing${query ? `?${query}` : ''}`);
}

export async function getOutgoingPayment(paymentId: string) {
  return request<OutgoingPayment>(`/api/payments/outgoing/${paymentId}`);
}

export async function exportPayments(from?: number, to?: number): Promise<string> {
  const queryParams = new URLSearchParams();
  if (from !== undefined) queryParams.append('from', String(from));
  if (to !== undefined) queryParams.append('to', String(to));
  const query = queryParams.toString();

  const response = await fetch(`${API_URL}/api/phoenixd/export${query ? `?${query}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to export payments');
  }

  return response.text();
}

// Decode
export async function decodeInvoice(params: { invoice: string }): Promise<{
  description: string;
  amountMsat?: number;
  expiry: number;
  timestamp: number;
  paymentHash: string;
}> {
  const response = await request<{
    chain: string;
    amount?: number;
    paymentHash: string;
    description: string;
    minFinalCltvExpiryDelta: number;
    paymentSecret: string;
    timestampSeconds: number;
  }>('/api/phoenixd/decodeinvoice', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // Map phoenixd response to our expected format
  // Default expiry is 3600 seconds (1 hour) if not specified
  // amount from phoenixd is already in millisats
  return {
    description: response.description || '',
    amountMsat: response.amount,
    expiry: 3600, // Default 1 hour expiry for BOLT11
    timestamp: response.timestampSeconds,
    paymentHash: response.paymentHash,
  };
}

export async function decodeOffer(params: { offer: string }) {
  return request<{
    offerId: string;
    description: string;
    nodeId: string;
    serialized: string;
  }>('/api/phoenixd/decodeoffer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// LNURL
export async function lnurlPay(params: { lnurl: string; amountSat: number; message?: string }) {
  return request<{
    recipientAmountSat: number;
    routingFeeSat: number;
    paymentId: string;
    paymentHash: string;
    paymentPreimage: string;
  }>('/api/lnurl/pay', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function lnurlWithdraw(params: { lnurl: string }) {
  return request<{
    receivedSat: number;
    paymentHash: string;
  }>('/api/lnurl/withdraw', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function lnurlAuth(params: { lnurl: string }) {
  return request<{ success: boolean }>('/api/lnurl/auth', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Auth
export type LockScreenBg =
  | 'lightning'
  | 'thunder-flash'
  | 'storm-clouds'
  | 'electric-storm'
  | 'night-lightning'
  | 'sky-thunder';

export interface AuthStatus {
  hasPassword: boolean;
  authenticated: boolean;
  autoLockMinutes: number;
  lockScreenBg: LockScreenBg;
}

export interface AuthSettings {
  hasPassword: boolean;
  autoLockMinutes: number;
  lockScreenBg: LockScreenBg;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/status');
}

export async function setupPassword(password: string) {
  return request<{ success: boolean; message: string }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function login(password: string) {
  return request<{ success: boolean }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout() {
  return request<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ success: boolean; message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function removePassword(password: string) {
  return request<{ success: boolean; message: string }>('/api/auth/remove-password', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

export async function getAuthSettings(): Promise<AuthSettings> {
  return request<AuthSettings>('/api/auth/settings');
}

export async function updateAuthSettings(settings: {
  autoLockMinutes?: number;
  lockScreenBg?: LockScreenBg;
}) {
  return request<AuthSettings>('/api/auth/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Get wallet seed phrase (requires password verification)
export async function getSeed(password: string) {
  return request<{ seed: string }>('/api/auth/seed', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

// Tor
export interface TorStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
}

export async function getTorStatus(): Promise<TorStatus> {
  return request<TorStatus>('/api/tor/status');
}

export async function enableTor() {
  return request<{ success: boolean; message: string }>('/api/tor/enable', {
    method: 'POST',
  });
}

export async function disableTor() {
  return request<{ success: boolean; message: string }>('/api/tor/disable', {
    method: 'POST',
  });
}

export async function removeTorImage() {
  return request<{ success: boolean; message: string }>('/api/tor/image', {
    method: 'DELETE',
  });
}
