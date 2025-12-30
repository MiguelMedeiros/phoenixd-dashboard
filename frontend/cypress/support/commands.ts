/// <reference types="cypress" />

// ***********************************************
// Custom Commands for Phoenixd Dashboard E2E Tests
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Setup all API mocks for the dashboard
       */
      setupApiMocks(): Chainable<void>;

      /**
       * Mock only node/balance related endpoints
       */
      mockNodeEndpoints(): Chainable<void>;

      /**
       * Mock only payment related endpoints
       */
      mockPaymentEndpoints(): Chainable<void>;

      /**
       * Mock invoice creation
       */
      mockCreateInvoice(overrides?: Record<string, unknown>): Chainable<void>;

      /**
       * Mock payment execution
       */
      mockPayInvoice(overrides?: Record<string, unknown>): Chainable<void>;

      /**
       * Mock LN Address payment
       */
      mockPayLnAddress(overrides?: Record<string, unknown>): Chainable<void>;

      /**
       * Mock LN Address payment error
       */
      mockPayLnAddressError(errorMessage?: string): Chainable<void>;

      /**
       * Wait for dashboard to fully load
       */
      waitForDashboard(): Chainable<void>;

      /**
       * Copy text to clipboard and verify
       */
      copyToClipboard(selector: string): Chainable<void>;
    }
  }
}

// Setup all API mocks
Cypress.Commands.add('setupApiMocks', () => {
  // Node endpoints
  cy.intercept('GET', '**/api/node/info', { fixture: 'node-info.json' }).as('getNodeInfo');
  cy.intercept('GET', '**/api/node/balance', { fixture: 'balance.json' }).as('getBalance');
  cy.intercept('GET', '**/api/node/channels', { fixture: 'channels.json' }).as('getChannels');
  cy.intercept('GET', '**/api/node/estimatefees*', { fixture: 'liquidity-fees.json' }).as(
    'getLiquidityFees'
  );
  cy.intercept('POST', '**/api/node/channels/close', { body: { txId: 'close-tx-123' } }).as(
    'closeChannel'
  );

  // Payment list endpoints
  cy.intercept('GET', '**/api/payments/incoming*', { fixture: 'incoming-payments.json' }).as(
    'getIncomingPayments'
  );
  cy.intercept('GET', '**/api/payments/outgoing*', { fixture: 'outgoing-payments.json' }).as(
    'getOutgoingPayments'
  );

  // Phoenixd endpoints
  cy.intercept('GET', '**/api/phoenixd/getlnaddress', { fixture: 'ln-address.json' }).as(
    'getLnAddress'
  );
  cy.intercept('POST', '**/api/phoenixd/createinvoice', { fixture: 'create-invoice.json' }).as(
    'createInvoice'
  );
  cy.intercept('POST', '**/api/phoenixd/createoffer', {
    body: { offer: 'lno1test123456789...' },
  }).as('createOffer');
  cy.intercept('POST', '**/api/phoenixd/payinvoice', { fixture: 'pay-invoice.json' }).as(
    'payInvoice'
  );
  cy.intercept('POST', '**/api/phoenixd/decodeinvoice', { fixture: 'decode-invoice.json' }).as(
    'decodeInvoice'
  );
  cy.intercept('POST', '**/api/phoenixd/decodeoffer', {
    body: {
      offerId: 'offer-test-123',
      description: 'Test offer',
      nodeId: '02abc...',
      serialized: 'lno1test...',
    },
  }).as('decodeOffer');

  // LNURL endpoints
  cy.intercept('POST', '**/api/lnurl/pay', { fixture: 'pay-invoice.json' }).as('lnurlPay');
  cy.intercept('POST', '**/api/lnurl/withdraw', {
    body: { receivedSat: 5000, paymentHash: 'abc123...' },
  }).as('lnurlWithdraw');
  cy.intercept('POST', '**/api/lnurl/auth', { body: { success: true } }).as('lnurlAuth');

  // LN Address payment
  cy.intercept('POST', '**/api/phoenixd/paylnaddress', { fixture: 'pay-lnaddress.json' }).as(
    'payLnAddress'
  );

  // Pay offer
  cy.intercept('POST', '**/api/phoenixd/payoffer', { fixture: 'pay-invoice.json' }).as('payOffer');
});

// Mock only node endpoints
Cypress.Commands.add('mockNodeEndpoints', () => {
  cy.intercept('GET', '**/api/node/info', { fixture: 'node-info.json' }).as('getNodeInfo');
  cy.intercept('GET', '**/api/node/balance', { fixture: 'balance.json' }).as('getBalance');
  cy.intercept('GET', '**/api/node/channels', { fixture: 'channels.json' }).as('getChannels');
});

// Mock only payment endpoints
Cypress.Commands.add('mockPaymentEndpoints', () => {
  cy.intercept('GET', '**/api/payments/incoming*', { fixture: 'incoming-payments.json' }).as(
    'getIncomingPayments'
  );
  cy.intercept('GET', '**/api/payments/outgoing*', { fixture: 'outgoing-payments.json' }).as(
    'getOutgoingPayments'
  );
});

// Mock invoice creation with optional overrides
Cypress.Commands.add('mockCreateInvoice', (overrides = {}) => {
  cy.fixture('create-invoice.json').then((invoice) => {
    cy.intercept('POST', '**/api/phoenixd/createinvoice', {
      body: { ...invoice, ...overrides },
    }).as('createInvoice');
  });
});

// Mock payment with optional overrides
Cypress.Commands.add('mockPayInvoice', (overrides = {}) => {
  cy.fixture('pay-invoice.json').then((payment) => {
    cy.intercept('POST', '**/api/phoenixd/payinvoice', {
      body: { ...payment, ...overrides },
    }).as('payInvoice');
  });
});

// Wait for dashboard to fully load
Cypress.Commands.add('waitForDashboard', () => {
  cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);
  cy.get('[data-testid="loading"]').should('not.exist');
});

// Copy to clipboard helper
Cypress.Commands.add('copyToClipboard', (selector: string) => {
  cy.get(selector).click();
  cy.contains('Copied').should('be.visible');
});

// Mock LN Address payment with optional overrides
Cypress.Commands.add('mockPayLnAddress', (overrides = {}) => {
  cy.fixture('pay-lnaddress.json').then((payment) => {
    cy.intercept('POST', '**/api/phoenixd/paylnaddress', {
      body: { ...payment, ...overrides },
    }).as('payLnAddress');
  });
});

// Mock LN Address payment error
Cypress.Commands.add('mockPayLnAddressError', (errorMessage = 'Payment failed') => {
  cy.intercept('POST', '**/api/phoenixd/paylnaddress', {
    statusCode: 500,
    body: { error: errorMessage },
  }).as('payLnAddressError');
});

export {};
