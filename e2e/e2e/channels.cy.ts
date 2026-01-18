describe('Channels Page', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    cy.intercept('GET', '**/api/auth/status', {
      body: {
        hasPassword: false,
        authenticated: true,
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
        setupCompleted: true,
        defaultLocale: 'en',
      },
    }).as('getAuthStatus');

    cy.intercept('GET', '**/api/setup/status', {
      body: {
        setupCompleted: true,
        setupProfile: 'full',
        defaultLocale: 'en',
      },
    }).as('getSetupStatus');

    cy.intercept('GET', '**/api/node/channels', { fixture: 'channels.json' }).as('getChannels');
    cy.intercept('GET', '**/api/node/info', { fixture: 'node-info.json' }).as('getNodeInfo');
  });

  describe('Page Load', () => {
    it('displays the channels page with header', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('h1', 'Channels').should('be.visible');
    });

    it('shows channel cards after loading', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.get('.glass-card').should('have.length.at.least', 1);
    });
  });

  describe('Stats Grid', () => {
    it('displays total capacity', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains(/capacity/i).should('exist');
    });

    it('displays outbound balance', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains(/outbound/i).should('exist');
    });

    it('displays inbound liquidity', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains(/inbound/i).should('exist');
    });
  });

  describe('Channel Information', () => {
    it('displays channel state badges', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('NORMAL').should('exist');
    });

    it('shows channel balance visualization', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.get('[class*="gradient"], [class*="from-"]').should('exist');
    });

    it('displays View on Mempool button', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', /mempool|view/i).should('exist');
    });
  });

  describe('Channel Actions', () => {
    it('has Close button for channels', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').should('exist');
    });

    it('opens close channel dialog when clicking Close', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      cy.contains('Close Channel').should('be.visible');
      cy.contains(/address/i).should('be.visible');
    });

    it('can cancel close channel dialog', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();
      cy.contains('Close Channel').should('be.visible');

      cy.contains('button', 'Cancel').click();

      cy.get('[role="dialog"]').should('not.exist');
    });

    it('successfully closes channel with valid inputs', () => {
      cy.intercept('POST', '**/api/node/channels/close', {
        statusCode: 200,
        body: { txId: 'mock-tx-id-123' },
        delay: 100,
      }).as('closeChannel');

      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      cy.get('input[id="address"]').type('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
      cy.get('input[id="feeRate"]').clear().type('10');

      cy.get('[role="dialog"]').contains('button', 'Close Channel').click();

      cy.wait('@closeChannel');

      cy.get('[role="dialog"]').should('not.exist');
    });
  });

  describe('Empty State', () => {
    it('shows empty state message when no channels', () => {
      cy.intercept('GET', '**/api/node/channels', { body: [] }).as('getEmptyChannels');

      cy.visit('/channels');
      cy.wait('@getEmptyChannels');

      cy.contains(/no channels/i).should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('h1', 'Channels').should('be.visible');
    });

    it('displays correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('h1', 'Channels').should('be.visible');
    });
  });
});
