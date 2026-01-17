interface PhoenixdConfig {
  url: string;
  password: string;
  isExternal: boolean;
}

export class PhoenixdService {
  private config: PhoenixdConfig;
  private static defaultUrl = process.env.PHOENIXD_URL || 'http://phoenixd:9740';
  private static defaultPassword = process.env.PHOENIXD_PASSWORD || '';

  constructor() {
    this.config = {
      url: PhoenixdService.defaultUrl,
      password: PhoenixdService.defaultPassword,
      isExternal: false,
    };
  }

  /**
   * Update the phoenixd configuration dynamically
   */
  updateConfig(url: string, password: string, isExternal: boolean): void {
    this.config = {
      url: url || PhoenixdService.defaultUrl,
      password: password || PhoenixdService.defaultPassword,
      isExternal,
    };
    console.log(`PhoenixdService config updated: ${isExternal ? 'external' : 'docker'} at ${this.config.url}`);
  }

  /**
   * Reset to default (Docker) configuration
   */
  resetToDefault(): void {
    this.config = {
      url: PhoenixdService.defaultUrl,
      password: PhoenixdService.defaultPassword,
      isExternal: false,
    };
    console.log('PhoenixdService config reset to default');
  }

  /**
   * Get current configuration (password masked for security)
   */
  getConfig(): { url: string; isExternal: boolean; hasPassword: boolean } {
    return {
      url: this.config.url,
      isExternal: this.config.isExternal,
      hasPassword: !!this.config.password,
    };
  }

  /**
   * Get the full configuration including password (for internal use only)
   */
  getFullConfig(): PhoenixdConfig {
    return { ...this.config };
  }

  /**
   * Get WebSocket URL for phoenixd connection
   */
  getWebSocketUrl(): string {
    return this.config.url.replace('http', 'ws') + '/websocket';
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`:${this.config.password}`).toString('base64');
  }

  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.config.url}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
    };

    const options: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      }
      options.body = formData.toString();
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Phoenixd API error: ${response.status} - ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  /**
   * Test connection to phoenixd with given credentials
   * Returns node info if successful, throws error if not
   */
  async testConnection(url: string, password: string): Promise<{
    nodeId: string;
    chain?: string;
    version?: string;
  }> {
    const testUrl = `${url}/getinfo`;
    const authHeader = 'Basic ' + Buffer.from(`:${password}`).toString('base64');

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Connection failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { nodeId: string; chain?: string; version?: string };
    return {
      nodeId: data.nodeId,
      chain: data.chain,
      version: data.version,
    };
  }

  // Node Management
  async getInfo() {
    return this.request<{
      nodeId: string;
      channels: Array<{
        state: string;
        channelId: string;
        balanceSat: number;
        inboundLiquiditySat: number;
        capacitySat: number;
        fundingTxId: string;
      }>;
    }>('GET', '/getinfo');
  }

  async getBalance() {
    return this.request<{
      balanceSat: number;
      feeCreditSat: number;
    }>('GET', '/getbalance');
  }

  async listChannels() {
    // Use /getinfo instead of /listchannels because /listchannels returns a complex nested structure
    // that doesn't match our expected Channel interface
    try {
      const info = await this.getInfo();
      return info?.channels || [];
    } catch (error) {
      console.error('Error listing channels:', error);
      return [];
    }
  }

  async closeChannel(params: { channelId: string; address: string; feerateSatByte: number }) {
    return this.request<string>(
      'POST',
      '/closechannel',
      params as unknown as Record<string, unknown>
    );
  }

  async estimateLiquidityFees(amountSat: number) {
    return this.request<{
      miningFeeSat: number;
      serviceFeeSat: number;
    }>('GET', `/estimateliquidityfees?amountSat=${amountSat}`);
  }

  // Payments - Create
  async createInvoice(params: {
    description?: string;
    descriptionHash?: string;
    amountSat?: number;
    expirySeconds?: number;
    externalId?: string;
    webhookUrl?: string;
  }) {
    return this.request<{
      amountSat: number;
      paymentHash: string;
      serialized: string;
    }>('POST', '/createinvoice', params as unknown as Record<string, unknown>);
  }

  async createOffer(params: { description?: string; amountSat?: number }) {
    return this.request<{ offer: string }>(
      'POST',
      '/createoffer',
      params as unknown as Record<string, unknown>
    );
  }

  async getLnAddress() {
    return this.request<string>('GET', '/getlnaddress');
  }

  // Payments - Pay
  async payInvoice(params: { invoice: string; amountSat?: number }) {
    return this.request<{
      recipientAmountSat: number;
      routingFeeSat: number;
      paymentId: string;
      paymentHash: string;
      paymentPreimage: string;
    }>('POST', '/payinvoice', params as unknown as Record<string, unknown>);
  }

  async payOffer(params: { offer: string; amountSat: number; message?: string }) {
    return this.request<{
      recipientAmountSat: number;
      routingFeeSat: number;
      paymentId: string;
      paymentHash: string;
      paymentPreimage: string;
    }>('POST', '/payoffer', params as unknown as Record<string, unknown>);
  }

  async payLnAddress(params: { address: string; amountSat: number; message?: string }) {
    return this.request<{
      recipientAmountSat: number;
      routingFeeSat: number;
      paymentId: string;
      paymentHash: string;
      paymentPreimage: string;
    }>('POST', '/paylnaddress', params as unknown as Record<string, unknown>);
  }

  async sendToAddress(params: { address: string; amountSat: number; feerateSatByte: number }) {
    return this.request<string>(
      'POST',
      '/sendtoaddress',
      params as unknown as Record<string, unknown>
    );
  }

  async bumpFee(feerateSatByte: number) {
    return this.request<string>('POST', '/bumpfee', { feerateSatByte });
  }

  // Payments - List
  async listIncomingPayments(params?: {
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
    all?: boolean;
    externalId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<unknown[]>('GET', `/payments/incoming${query ? `?${query}` : ''}`);
  }

  async getIncomingPayment(paymentHash: string) {
    return this.request<unknown>('GET', `/payments/incoming/${paymentHash}`);
  }

  async listOutgoingPayments(params?: {
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
    all?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<unknown[]>('GET', `/payments/outgoing${query ? `?${query}` : ''}`);
  }

  async getOutgoingPayment(paymentId: string) {
    return this.request<unknown>('GET', `/payments/outgoing/${paymentId}`);
  }

  async getOutgoingPaymentByHash(paymentHash: string) {
    return this.request<unknown>('GET', `/payments/outgoingbyhash/${paymentHash}`);
  }

  async exportCsv(from?: number, to?: number) {
    const params: Record<string, number | undefined> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return this.request<string>('POST', '/export', params);
  }

  // Decode
  async decodeInvoice(invoice: string) {
    return this.request<{
      chain: string;
      amount: number;
      paymentHash: string;
      description: string;
      minFinalCltvExpiryDelta: number;
      paymentSecret: string;
      timestampSeconds: number;
    }>('POST', '/decodeinvoice', { invoice });
  }

  async decodeOffer(offer: string) {
    return this.request<{
      chain: string;
      chainHashes: string[];
    }>('POST', '/decodeoffer', { offer });
  }

  // LNURL
  async lnurlPay(lnurl: string, amountSat: number, message?: string) {
    return this.request<{
      recipientAmountSat: number;
      routingFeeSat: number;
      paymentId: string;
      paymentHash: string;
      paymentPreimage: string;
    }>('POST', '/lnurlpay', { lnurl, amountSat, message });
  }

  async lnurlWithdraw(lnurl: string) {
    return this.request<{
      url: string;
      minWithdrawable: number;
      maxWithdrawable: number;
      description: string;
      k1: string;
      invoice: string;
    }>('POST', '/lnurlwithdraw', { lnurl });
  }

  async lnurlAuth(lnurl: string) {
    return this.request<string>('POST', '/lnurlauth', { lnurl });
  }
}
