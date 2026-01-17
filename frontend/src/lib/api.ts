// Detect API URL dynamically based on access method
// This enables the dashboard to work from any hostname without configuration
function getApiUrl(): string {
  // On server-side, use the environment variable
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
  }

  const { protocol, hostname } = window.location;
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;

  // If a custom API URL is explicitly configured (not the default localhost),
  // respect that configuration
  if (configuredUrl && !configuredUrl.includes('localhost:4001')) {
    return configuredUrl;
  }

  // Auto-detect API URL based on current hostname
  // This allows the dashboard to work when accessed via:
  // - localhost (development)
  // - Local IP (e.g., 192.168.1.100)
  // - Tailscale Magic DNS (*.ts.net)
  // - Cloudflare Tunnel (custom domain)
  // - Custom domain

  // For Tailscale, we may need to use port 4001
  if (hostname.endsWith('.ts.net')) {
    return `${protocol}//${hostname}:4001`;
  }

  // For Tor Hidden Service (.onion), use port 4000 for the backend API
  if (hostname.endsWith('.onion')) {
    return `${protocol}//${hostname}:4000`;
  }

  // For localhost, use the default port mapping
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4001';
  }

  // For local IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x), use port 4001
  const localIpPattern = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
  if (localIpPattern.test(hostname)) {
    return `${protocol}//${hostname}:4001`;
  }

  // For Cloudflare Tunnel or custom domains (not localhost, not local IP, not .ts.net),
  // use the API subdomain pattern: phoenixd.domain.com -> phoenixd-api.domain.com
  // This assumes the API is hosted on a subdomain with "-api" suffix
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    // Replace the first subdomain with subdomain-api
    // e.g., phoenixd.miguelmedeiros.dev -> phoenixd-api.miguelmedeiros.dev
    parts[0] = `${parts[0]}-api`;
    return `${protocol}//${parts.join('.')}`;
  }

  // Fallback: use same hostname with port 4001
  return `${protocol}//${hostname}:4001`;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const API_URL = getApiUrl();
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

  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/phoenixd/export${query ? `?${query}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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
export interface TorHiddenService {
  frontend: string;
  backend: string;
}

export interface TorStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
  imageExists?: boolean;
  onionAddress?: string;
  hiddenService?: TorHiddenService | null;
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

// Tailscale
export interface TailscaleStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
  imageExists: boolean;
  dnsName: string | null;
  hostname: string | null;
  hasAuthKey: boolean;
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  return request<TailscaleStatus>('/api/tailscale/status');
}

export async function saveTailscaleAuthKey(authKey: string, hostname?: string) {
  return request<{ success: boolean; message: string }>('/api/tailscale/authkey', {
    method: 'PUT',
    body: JSON.stringify({ authKey, hostname }),
  });
}

export async function removeTailscaleAuthKey() {
  return request<{ success: boolean; message: string }>('/api/tailscale/authkey', {
    method: 'DELETE',
  });
}

export async function enableTailscale() {
  return request<{ success: boolean; message: string; dnsName?: string }>('/api/tailscale/enable', {
    method: 'POST',
  });
}

export async function disableTailscale() {
  return request<{ success: boolean; message: string }>('/api/tailscale/disable', {
    method: 'POST',
  });
}

export async function refreshTailscaleDns() {
  return request<{ success: boolean; dnsName?: string }>('/api/tailscale/refresh-dns', {
    method: 'POST',
  });
}

export async function removeTailscaleImage() {
  return request<{ success: boolean; message: string }>('/api/tailscale/image', {
    method: 'DELETE',
  });
}

// Cloudflared
export interface CloudflaredIngressRule {
  hostname: string;
  service: string;
  path?: string;
}

export interface CloudflaredStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  containerExists: boolean;
  imageExists: boolean;
  hasToken: boolean;
  ingress: CloudflaredIngressRule[];
}

export async function getCloudflaredStatus(): Promise<CloudflaredStatus> {
  return request<CloudflaredStatus>('/api/cloudflared/status');
}

export async function saveCloudflaredToken(token: string) {
  return request<{ success: boolean; message: string }>('/api/cloudflared/token', {
    method: 'PUT',
    body: JSON.stringify({ token }),
  });
}

export async function removeCloudflaredToken() {
  return request<{ success: boolean; message: string }>('/api/cloudflared/token', {
    method: 'DELETE',
  });
}

export async function updateCloudflaredIngress(ingress: CloudflaredIngressRule[]) {
  return request<{ success: boolean; message: string; ingress: CloudflaredIngressRule[] }>(
    '/api/cloudflared/ingress',
    {
      method: 'PUT',
      body: JSON.stringify({ ingress }),
    }
  );
}

export async function enableCloudflared() {
  return request<{ success: boolean; message: string }>('/api/cloudflared/enable', {
    method: 'POST',
  });
}

export async function disableCloudflared() {
  return request<{ success: boolean; message: string }>('/api/cloudflared/disable', {
    method: 'POST',
  });
}

export async function getCloudflaredLogs() {
  return request<{ logs: string }>('/api/cloudflared/logs');
}

export async function removeCloudflaredImage() {
  return request<{ success: boolean; message: string }>('/api/cloudflared/image', {
    method: 'DELETE',
  });
}

// Config / Dynamic URLs
export interface DynamicUrls {
  apiUrl: string;
  wsUrl: string;
  tailscaleApiUrl: string | null;
  tailscaleWsUrl: string | null;
  tailscaleFrontendUrl: string | null;
  tailscaleEnabled: boolean;
  tailscaleHealthy: boolean;
  tailscaleDnsName: string | null;
}

export async function getDynamicUrls(): Promise<DynamicUrls> {
  return request<DynamicUrls>('/api/config/urls');
}

export async function detectAccessType(): Promise<{
  isTailscaleAccess: boolean;
  host: string;
  tailscaleDnsName: string | null;
}> {
  return request<{
    isTailscaleAccess: boolean;
    host: string;
    tailscaleDnsName: string | null;
  }>('/api/config/detect-access');
}

// Docker
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
}

export async function getContainers(): Promise<ContainerInfo[]> {
  return request<ContainerInfo[]>('/api/docker/containers');
}

// Phoenixd Container Control
export interface PhoenixdContainerStatus {
  exists: boolean;
  running: boolean;
  state: string;
  status?: string;
  name: string | null;
  id?: string;
}

export async function getPhoenixdContainerStatus(): Promise<PhoenixdContainerStatus> {
  return request<PhoenixdContainerStatus>('/api/docker/phoenixd/status');
}

export async function startPhoenixdContainer(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/api/docker/phoenixd/start', {
    method: 'POST',
  });
}

export async function stopPhoenixdContainer(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/api/docker/phoenixd/stop', {
    method: 'POST',
  });
}

// Contacts
export type ContactType = 'lightning_address' | 'node_id' | 'bolt12_offer';

export interface ContactAddress {
  id: string;
  contactId: string;
  address: string;
  type: ContactType;
  isPrimary: boolean;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  label?: string | null; // Label for categorizing the contact (e.g., "Personal", "Work")
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: ContactAddress[];
  _count?: {
    payments: number;
  };
}

export interface CreateContactAddressInput {
  id?: string; // Include ID when updating to preserve address references
  address: string;
  type: ContactType;
  isPrimary?: boolean;
}

export async function getContacts(search?: string): Promise<Contact[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<Contact[]>(`/api/contacts${query}`);
}

export async function getContact(id: string): Promise<Contact> {
  return request<Contact>(`/api/contacts/${id}`);
}

export async function createContact(data: {
  name: string;
  label?: string;
  avatarUrl?: string;
  addresses: CreateContactAddressInput[];
}): Promise<Contact> {
  return request<Contact>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateContact(
  id: string,
  data: {
    name?: string;
    label?: string | null;
    avatarUrl?: string | null;
    addresses?: CreateContactAddressInput[];
  }
): Promise<Contact> {
  return request<Contact>(`/api/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteContact(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/contacts/${id}`, {
    method: 'DELETE',
  });
}

// Contact Address Management
export async function addContactAddress(
  contactId: string,
  data: {
    address: string;
    type: ContactType;
    label?: string;
    isPrimary?: boolean;
  }
): Promise<ContactAddress> {
  return request<ContactAddress>(`/api/contacts/${contactId}/addresses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateContactAddress(
  contactId: string,
  addressId: string,
  data: {
    address?: string;
    type?: ContactType;
    label?: string | null;
    isPrimary?: boolean;
  }
): Promise<ContactAddress> {
  return request<ContactAddress>(`/api/contacts/${contactId}/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteContactAddress(
  contactId: string,
  addressId: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(
    `/api/contacts/${contactId}/addresses/${addressId}`,
    {
      method: 'DELETE',
    }
  );
}

export async function getContactPayments(
  contactId: string,
  params?: { limit?: number; offset?: number }
): Promise<PaymentMetadata[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));
  const query = queryParams.toString();
  return request<PaymentMetadata[]>(
    `/api/contacts/${contactId}/payments${query ? `?${query}` : ''}`
  );
}

// Payment Categories
export interface PaymentCategory {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  createdAt: string;
  _count?: {
    payments: number;
  };
}

export async function getCategories(): Promise<PaymentCategory[]> {
  return request<PaymentCategory[]>('/api/categories');
}

export async function getCategory(id: string): Promise<PaymentCategory> {
  return request<PaymentCategory>(`/api/categories/${id}`);
}

export async function createCategory(data: {
  name: string;
  color?: string;
  icon?: string;
}): Promise<PaymentCategory> {
  return request<PaymentCategory>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    color?: string;
    icon?: string | null;
  }
): Promise<PaymentCategory> {
  return request<PaymentCategory>(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/categories/${id}`, {
    method: 'DELETE',
  });
}

// Payment Metadata
export interface PaymentMetadata {
  id: string;
  paymentHash?: string | null;
  paymentId?: string | null;
  note?: string | null;
  contactId?: string | null;
  contact?: Contact | null;
  categories?: PaymentCategory[];
  createdAt: string;
  updatedAt: string;
}

export async function getPaymentMetadata(identifier: string): Promise<PaymentMetadata> {
  return request<PaymentMetadata>(`/api/payments/metadata/${identifier}`);
}

export async function updatePaymentMetadata(
  identifier: string,
  data: {
    note?: string | null;
    categoryIds?: string[];
    contactId?: string | null;
    isIncoming?: boolean;
  }
): Promise<PaymentMetadata> {
  return request<PaymentMetadata>(`/api/payments/metadata/${identifier}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getPaymentsByCategory(
  categoryId: string,
  params?: { limit?: number; offset?: number }
): Promise<PaymentMetadata[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));
  const query = queryParams.toString();
  return request<PaymentMetadata[]>(
    `/api/payments/metadata/by-category/${categoryId}${query ? `?${query}` : ''}`
  );
}

export async function getPaymentsByContact(
  contactId: string,
  params?: { limit?: number; offset?: number }
): Promise<PaymentMetadata[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));
  const query = queryParams.toString();
  return request<PaymentMetadata[]>(
    `/api/payments/metadata/by-contact/${contactId}${query ? `?${query}` : ''}`
  );
}

export async function batchGetPaymentMetadata(params: {
  paymentHashes?: string[];
  paymentIds?: string[];
}): Promise<Record<string, PaymentMetadata>> {
  return request<Record<string, PaymentMetadata>>('/api/payments/metadata/batch', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Recurring Payments
export type RecurringPaymentFrequency =
  | 'every_minute'
  | 'every_5_minutes'
  | 'every_15_minutes'
  | 'every_30_minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly';
export type RecurringPaymentStatus = 'active' | 'paused' | 'cancelled';

export interface RecurringPaymentExecution {
  id: string;
  recurringPaymentId: string;
  status: 'success' | 'failed' | 'pending';
  amountSat: number;
  paymentId?: string | null;
  paymentHash?: string | null;
  errorMessage?: string | null;
  executedAt: string;
}

export interface RecurringPayment {
  id: string;
  contactId: string;
  addressId: string;
  connectionId?: string | null; // PhoenixdConnection ID - which node executes this payment
  amountSat: number;
  frequency: RecurringPaymentFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  timeOfDay: string;
  note?: string | null;
  categoryId?: string | null;
  status: RecurringPaymentStatus;
  nextRunAt: string;
  lastRunAt?: string | null;
  lastError?: string | null;
  totalPaid: number;
  paymentCount: number;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
  category?: PaymentCategory | null;
  connection?: {
    id: string;
    name: string;
    isDocker: boolean;
  } | null;
  executions?: RecurringPaymentExecution[];
  _count?: {
    executions: number;
  };
}

export async function getRecurringPayments(params?: {
  status?: RecurringPaymentStatus;
  contactId?: string;
}): Promise<RecurringPayment[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.contactId) queryParams.append('contactId', params.contactId);
  const query = queryParams.toString();
  return request<RecurringPayment[]>(`/api/recurring-payments${query ? `?${query}` : ''}`);
}

export async function getRecurringPayment(id: string): Promise<RecurringPayment> {
  return request<RecurringPayment>(`/api/recurring-payments/${id}`);
}

export async function createRecurringPayment(data: {
  contactId: string;
  addressId: string;
  amountSat: number;
  frequency: RecurringPaymentFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  note?: string;
  categoryId?: string;
}): Promise<RecurringPayment> {
  return request<RecurringPayment>('/api/recurring-payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecurringPayment(
  id: string,
  data: {
    addressId?: string;
    amountSat?: number;
    frequency?: RecurringPaymentFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    note?: string | null;
    categoryId?: string | null;
    status?: RecurringPaymentStatus;
  }
): Promise<RecurringPayment> {
  return request<RecurringPayment>(`/api/recurring-payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRecurringPayment(
  id: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/recurring-payments/${id}`, {
    method: 'DELETE',
  });
}

export async function getRecurringPaymentExecutions(
  id: string,
  params?: { limit?: number; offset?: number }
): Promise<RecurringPaymentExecution[]> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));
  const query = queryParams.toString();
  return request<RecurringPaymentExecution[]>(
    `/api/recurring-payments/${id}/executions${query ? `?${query}` : ''}`
  );
}

export async function executeRecurringPaymentNow(id: string): Promise<{
  success: boolean;
  paymentId?: string;
  paymentHash?: string;
  amountSat?: number;
  error?: string;
}> {
  return request<{
    success: boolean;
    paymentId?: string;
    paymentHash?: string;
    amountSat?: number;
    error?: string;
  }>(`/api/recurring-payments/${id}/execute`, {
    method: 'POST',
  });
}

// Phoenixd Connection Configuration
export interface PhoenixdConfig {
  useExternalPhoenixd: boolean;
  phoenixdUrl: string;
  hasPassword: boolean;
  activeUrl: string;
  activeIsExternal: boolean;
  activeHasPassword: boolean;
}

export interface PhoenixdConnectionStatus {
  connected: boolean;
  nodeId: string | null;
  error: string | null;
  url: string;
  isExternal: boolean;
}

export interface PhoenixdTestResult {
  success: boolean;
  message?: string;
  nodeId?: string;
  chain?: string;
  version?: string;
  error?: string;
}

export async function getPhoenixdConfig(): Promise<PhoenixdConfig> {
  return request<PhoenixdConfig>('/api/phoenixd/config');
}

export async function savePhoenixdConfig(data: {
  useExternalPhoenixd: boolean;
  phoenixdUrl?: string;
  phoenixdPassword?: string;
}): Promise<{
  success: boolean;
  message: string;
  useExternalPhoenixd: boolean;
  phoenixdUrl: string;
}> {
  return request<{
    success: boolean;
    message: string;
    useExternalPhoenixd: boolean;
    phoenixdUrl: string;
  }>('/api/phoenixd/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function testPhoenixdConnection(data: {
  url: string;
  password?: string;
}): Promise<PhoenixdTestResult> {
  return request<PhoenixdTestResult>('/api/phoenixd/test-connection', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPhoenixdConnectionStatus(): Promise<PhoenixdConnectionStatus> {
  return request<PhoenixdConnectionStatus>('/api/phoenixd/connection-status');
}

export async function reconnectPhoenixd(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/api/phoenixd/reconnect', {
    method: 'POST',
  });
}

// Phoenixd Connections (Multi-instance management)
export interface PhoenixdConnection {
  id: string;
  name: string;
  url: string;
  isDocker: boolean;
  isActive: boolean;
  nodeId?: string | null;
  chain?: string | null;
  lastConnectedAt?: string | null;
  createdAt: string;
}

export interface ActiveConnectionStatus {
  connection: PhoenixdConnection | null;
  status: {
    connected: boolean;
    nodeId: string | null;
    error: string | null;
  };
}

export async function getPhoenixdConnections(): Promise<PhoenixdConnection[]> {
  return request<PhoenixdConnection[]>('/api/phoenixd-connections');
}

export async function getActiveConnection(): Promise<ActiveConnectionStatus> {
  return request<ActiveConnectionStatus>('/api/phoenixd-connections/active');
}

export async function createPhoenixdConnection(data: {
  name: string;
  url: string;
  password?: string;
}): Promise<PhoenixdConnection> {
  return request<PhoenixdConnection>('/api/phoenixd-connections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePhoenixdConnection(
  id: string,
  data: {
    name?: string;
    url?: string;
    password?: string;
  }
): Promise<PhoenixdConnection> {
  return request<PhoenixdConnection>(`/api/phoenixd-connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePhoenixdConnection(
  id: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/phoenixd-connections/${id}`, {
    method: 'DELETE',
  });
}

export async function activatePhoenixdConnection(
  id: string
): Promise<{ success: boolean; message: string; connection: PhoenixdConnection }> {
  return request<{ success: boolean; message: string; connection: PhoenixdConnection }>(
    `/api/phoenixd-connections/${id}/activate`,
    {
      method: 'POST',
    }
  );
}

export async function testPhoenixdConnectionById(id: string): Promise<PhoenixdTestResult> {
  return request<PhoenixdTestResult>(`/api/phoenixd-connections/${id}/test`, {
    method: 'POST',
  });
}

export async function testNewPhoenixdConnection(data: {
  url: string;
  password?: string;
}): Promise<PhoenixdTestResult> {
  return request<PhoenixdTestResult>('/api/phoenixd-connections/test', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Apps
export interface App {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  sourceType: string;
  sourceUrl: string;
  version?: string | null;
  containerName?: string | null;
  containerStatus: string;
  internalPort: number;
  envVars?: string | null;
  webhookEvents?: string | null;
  webhookSecret?: string | null;
  webhookPath: string;
  apiKey?: string | null;
  apiPermissions?: string | null;
  isEnabled: boolean;
  lastHealthCheck?: string | null;
  healthStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    webhookLogs: number;
  };
}

export interface AppWebhookLog {
  id: string;
  appId: string;
  eventType: string;
  payload: string;
  statusCode?: number | null;
  response?: string | null;
  success: boolean;
  latencyMs?: number | null;
  createdAt: string;
}

export async function getApps(): Promise<App[]> {
  return request<App[]>('/api/apps');
}

export async function getApp(id: string): Promise<App> {
  return request<App>(`/api/apps/${id}`);
}

export async function installApp(data: {
  name: string;
  sourceType: string;
  sourceUrl: string;
  description?: string;
  icon?: string;
  version?: string;
  webhookEvents?: string[];
  apiPermissions?: string[];
  envVars?: Record<string, string>;
  internalPort?: number;
}): Promise<App> {
  return request<App>('/api/apps', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApp(
  id: string,
  data: {
    name?: string;
    description?: string;
    icon?: string;
    webhookEvents?: string[];
    webhookPath?: string;
    apiPermissions?: string[];
    envVars?: Record<string, string>;
    isEnabled?: boolean;
    internalPort?: number;
  }
): Promise<App> {
  return request<App>(`/api/apps/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uninstallApp(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/apps/${id}`, {
    method: 'DELETE',
  });
}

export async function startApp(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/apps/${id}/start`, {
    method: 'POST',
  });
}

export async function stopApp(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/apps/${id}/stop`, {
    method: 'POST',
  });
}

export async function restartApp(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/apps/${id}/restart`, {
    method: 'POST',
  });
}

export async function getAppLogs(id: string, tail?: number): Promise<{ logs: string }> {
  const query = tail ? `?tail=${tail}` : '';
  return request<{ logs: string }>(`/api/apps/${id}/logs${query}`);
}

export async function getAppWebhooks(
  id: string,
  limit?: number,
  offset?: number
): Promise<AppWebhookLog[]> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<AppWebhookLog[]>(`/api/apps/${id}/webhooks${query}`);
}

export async function regenerateAppKey(id: string): Promise<{ apiKey: string }> {
  return request<{ apiKey: string }>(`/api/apps/${id}/regenerate-key`, {
    method: 'POST',
  });
}

export async function regenerateAppSecret(id: string): Promise<{ webhookSecret: string }> {
  return request<{ webhookSecret: string }>(`/api/apps/${id}/regenerate-secret`, {
    method: 'POST',
  });
}

export async function getAppStatus(id: string): Promise<{
  containerStatus: string;
  healthStatus: string;
  running: boolean;
}> {
  return request<{
    containerStatus: string;
    healthStatus: string;
    running: boolean;
  }>(`/api/apps/${id}/status`);
}
