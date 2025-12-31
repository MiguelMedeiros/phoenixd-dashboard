describe('Channels Page', () => {
  beforeEach(() => {
    // Auth mock - allow access
    cy.intercept('GET', '**/api/auth/status', {
      body: {
        hasPassword: false,
        authenticated: true,
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      },
    }).as('getAuthStatus');

    cy.intercept('GET', '**/api/node/channels', { fixture: 'channels.json' }).as('getChannels');
    cy.intercept('GET', '**/api/node/info', { fixture: 'node-info.json' }).as('getNodeInfo');
  });

  describe('Page Load', () => {
    it('displays the channels page with header', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('h1', 'Channels').should('be.visible');
      cy.contains('Manage your Lightning channels').should('be.visible');
    });

    it('shows channel cards after loading', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      // Should have at least one channel card (3 from fixture)
      cy.get('.glass-card').should('have.length.at.least', 3);
    });
  });

  describe('Stats Grid', () => {
    it('displays total capacity', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('Total Capacity').should('exist');
    });

    it('displays outbound balance', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('Outbound').should('exist');
    });

    it('displays inbound liquidity', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('Inbound').should('exist');
    });
  });

  describe('Channel Information', () => {
    it('displays channel state badges', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      // At least NORMAL channels should exist
      cy.contains('NORMAL').should('exist');
    });

    it('shows channel balance visualization bar', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      // Check for the gradient bar
      cy.get('[class*="from-lightning"]').should('exist');
    });

    it('displays View on Mempool button', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'View on Mempool').should('exist');
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

      // Click the first Close button
      cy.contains('button', 'Close').first().click();

      // Dialog should be visible
      cy.contains('Close Channel').should('be.visible');
      cy.contains('Bitcoin Address').should('be.visible');
      cy.contains('Fee Rate').should('be.visible');
    });

    it('shows warning message in close dialog', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      cy.contains('Warning').should('be.visible');
      cy.contains('irreversible').should('be.visible');
    });

    it('can cancel close channel dialog', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();
      cy.contains('Close Channel').should('be.visible');

      // Click cancel
      cy.contains('button', 'Cancel').click();

      // Dialog should be closed
      cy.contains('Bitcoin Address').should('not.exist');
    });

    it('validates empty address in close dialog', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      // Try to close without entering address
      cy.get('[role="dialog"]').contains('button', 'Close Channel').should('be.disabled');
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

      // Enter valid address and fee rate
      cy.get('input[id="address"]').type('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
      cy.get('input[id="feeRate"]').clear().type('10');

      // Click close channel button
      cy.get('[role="dialog"]').contains('button', 'Close Channel').click();

      // Wait for API call and verify request was made
      cy.wait('@closeChannel').then((interception) => {
        expect(interception.request.body).to.have.property('address');
        expect(interception.request.body.address).to.equal(
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
        );
      });

      // Dialog should close after successful API call
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('shows error for invalid address format', () => {
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      // Enter invalid address
      cy.get('input[id="address"]').type('invalid-address');
      cy.get('input[id="feeRate"]').clear().type('10');

      // Click close channel button
      cy.get('[role="dialog"]').contains('button', 'Close Channel').click();

      // Error message should appear
      cy.contains('Invalid').should('be.visible');
    });

    it('handles API error gracefully', () => {
      cy.intercept('POST', '**/api/node/channels/close', {
        statusCode: 400,
        body: { error: 'Channel not found' },
      }).as('closeChannelError');

      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      cy.get('input[id="address"]').type('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
      cy.get('input[id="feeRate"]').clear().type('10');

      cy.get('[role="dialog"]').contains('button', 'Close Channel').click();

      cy.wait('@closeChannelError');

      // Error should be displayed
      cy.get('[role="dialog"]').should('be.visible');
    });
  });

  describe('Empty State', () => {
    it('shows empty state message when no channels', () => {
      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: false,
          authenticated: true,
          autoLockMinutes: 0,
          lockScreenBg: 'storm-clouds',
        },
      }).as('getAuthStatus');
      cy.intercept('GET', '**/api/node/channels', { body: [] }).as('getEmptyChannels');
      cy.intercept('GET', '**/api/node/info', { fixture: 'node-info.json' }).as('getNodeInfo');

      cy.visit('/channels');
      cy.wait('@getEmptyChannels');

      cy.contains('No Channels Yet').should('be.visible');
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

    it('close dialog works on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('button', 'Close').first().click();

      cy.contains('Close Channel').should('be.visible');
      cy.get('input[id="address"]').should('be.visible');
    });
  });
});
