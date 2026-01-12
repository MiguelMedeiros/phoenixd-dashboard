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

      /**
       * Mock auth endpoints - no password configured
       */
      mockAuthNoPassword(): Chainable<void>;

      /**
       * Mock auth endpoints - password configured but not authenticated
       */
      mockAuthLocked(): Chainable<void>;

      /**
       * Mock auth endpoints - password configured and authenticated
       */
      mockAuthAuthenticated(): Chainable<void>;

      /**
       * Mock successful login
       */
      mockLoginSuccess(): Chainable<void>;

      /**
       * Mock failed login
       */
      mockLoginFailure(): Chainable<void>;

      /**
       * Mock seed retrieval
       */
      mockGetSeed(seed?: string): Chainable<void>;

      /**
       * Mock seed retrieval failure
       */
      mockGetSeedFailure(errorMessage?: string): Chainable<void>;

      /**
       * Mock contacts with fixtures
       */
      mockContactsWithData(): Chainable<void>;

      /**
       * Mock recurring payments with fixtures
       */
      mockRecurringPaymentsWithData(): Chainable<void>;

      /**
       * Setup all mocks for contacts page
       */
      setupContactsMocks(): Chainable<void>;
    }
  }
}

// Setup all API mocks
Cypress.Commands.add('setupApiMocks', () => {
  // Auth endpoints - mock as no password configured (allows access)
  cy.intercept('GET', '**/api/auth/status', {
    body: {
      hasPassword: false,
      authenticated: true,
      autoLockMinutes: 0,
      lockScreenBg: 'storm-clouds',
    },
  }).as('getAuthStatus');

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

  // Contacts endpoints
  cy.intercept('GET', '**/api/contacts*', { body: [] }).as('getContacts');
  cy.intercept('POST', '**/api/contacts', { body: { id: 'contact-1', name: 'Test Contact', addresses: [] } }).as('createContact');

  // Recurring payments endpoints
  cy.intercept('GET', '**/api/recurring-payments*', { body: [] }).as('getRecurringPayments');
  cy.intercept('POST', '**/api/recurring-payments', { body: { id: 'recurring-1', status: 'active' } }).as('createRecurringPayment');

  // Categories endpoint
  cy.intercept('GET', '**/api/categories*', { body: [] }).as('getCategories');
});

// Mock only node endpoints
Cypress.Commands.add('mockNodeEndpoints', () => {
  // Auth endpoint - allow access
  cy.intercept('GET', '**/api/auth/status', {
    body: {
      hasPassword: false,
      authenticated: true,
      autoLockMinutes: 0,
      lockScreenBg: 'storm-clouds',
    },
  }).as('getAuthStatus');

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

// Mock auth - no password configured
Cypress.Commands.add('mockAuthNoPassword', () => {
  cy.intercept('GET', '**/api/auth/status', {
    body: {
      hasPassword: false,
      authenticated: true,
      autoLockMinutes: 0,
      lockScreenBg: 'storm-clouds',
    },
  }).as('getAuthStatus');
});

// Mock auth - password configured but locked (not authenticated)
Cypress.Commands.add('mockAuthLocked', () => {
  cy.intercept('GET', '**/api/auth/status', {
    body: {
      hasPassword: true,
      authenticated: false,
      autoLockMinutes: 5,
      lockScreenBg: 'storm-clouds',
    },
  }).as('getAuthStatus');
});

// Mock auth - password configured and authenticated
Cypress.Commands.add('mockAuthAuthenticated', () => {
  cy.intercept('GET', '**/api/auth/status', {
    body: {
      hasPassword: true,
      authenticated: true,
      autoLockMinutes: 5,
      lockScreenBg: 'storm-clouds',
    },
  }).as('getAuthStatus');

  cy.intercept('GET', '**/api/auth/settings', {
    body: {
      hasPassword: true,
      autoLockMinutes: 5,
      lockScreenBg: 'storm-clouds',
    },
  }).as('getAuthSettings');
});

// Mock successful login
Cypress.Commands.add('mockLoginSuccess', () => {
  cy.intercept('POST', '**/api/auth/login', {
    body: { success: true },
  }).as('login');
});

// Mock failed login
Cypress.Commands.add('mockLoginFailure', () => {
  cy.intercept('POST', '**/api/auth/login', {
    statusCode: 401,
    body: { error: 'Invalid password' },
  }).as('loginFailure');
});

// Mock seed retrieval
Cypress.Commands.add(
  'mockGetSeed',
  (
    seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  ) => {
    cy.intercept('POST', '**/api/auth/seed', {
      body: { seed },
    }).as('getSeed');
  }
);

// Mock seed retrieval failure
Cypress.Commands.add('mockGetSeedFailure', (errorMessage = 'Invalid password') => {
  cy.intercept('POST', '**/api/auth/seed', {
    statusCode: 401,
    body: { error: errorMessage },
  }).as('getSeedFailure');
});

// Mock contacts with fixture data
Cypress.Commands.add('mockContactsWithData', () => {
  cy.intercept('GET', '**/api/contacts*', { fixture: 'contacts.json' }).as('getContactsWithData');
  cy.intercept('POST', '**/api/contacts', (req) => {
    req.reply({
      statusCode: 201,
      body: {
        id: 'new-contact-' + Date.now(),
        name: req.body.name,
        label: req.body.label || null,
        addresses: req.body.addresses || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { payments: 0 },
      },
    });
  }).as('createContactWithData');
  cy.intercept('PUT', '**/api/contacts/*', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        ...req.body,
        updatedAt: new Date().toISOString(),
      },
    });
  }).as('updateContact');
  cy.intercept('DELETE', '**/api/contacts/*', {
    statusCode: 200,
    body: { success: true },
  }).as('deleteContact');
});

// Mock recurring payments with fixture data
Cypress.Commands.add('mockRecurringPaymentsWithData', () => {
  cy.intercept('GET', '**/api/recurring-payments*', { fixture: 'recurring-payments.json' }).as(
    'getRecurringPaymentsWithData'
  );
  cy.intercept('GET', '**/api/recurring-payments/*/executions*', {
    fixture: 'recurring-executions.json',
  }).as('getRecurringExecutions');
  cy.intercept('POST', '**/api/recurring-payments', (req) => {
    req.reply({
      statusCode: 201,
      body: {
        id: 'new-recurring-' + Date.now(),
        ...req.body,
        status: 'active',
        paymentCount: 0,
        totalPaidSat: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }).as('createRecurringPaymentWithData');
  cy.intercept('PUT', '**/api/recurring-payments/*', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        ...req.body,
        updatedAt: new Date().toISOString(),
      },
    });
  }).as('updateRecurringPayment');
  cy.intercept('DELETE', '**/api/recurring-payments/*', {
    statusCode: 200,
    body: { success: true },
  }).as('deleteRecurringPayment');
  cy.intercept('POST', '**/api/recurring-payments/*/pause', (req) => {
    req.reply({
      statusCode: 200,
      body: { status: 'paused' },
    });
  }).as('pauseRecurringPayment');
  cy.intercept('POST', '**/api/recurring-payments/*/resume', (req) => {
    req.reply({
      statusCode: 200,
      body: { status: 'active' },
    });
  }).as('resumeRecurringPayment');
});

// Setup all mocks for contacts page
Cypress.Commands.add('setupContactsMocks', () => {
  cy.setupApiMocks();
  cy.mockContactsWithData();
  cy.mockRecurringPaymentsWithData();
});

export {};
