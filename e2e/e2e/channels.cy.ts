describe('Channels Page', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/node/channels', { fixture: 'channels.json' }).as('getChannels');
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
  });

  describe('Empty State', () => {
    it('shows empty state message when no channels', () => {
      cy.intercept('GET', '**/api/node/channels', { body: [] }).as('getEmptyChannels');

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
  });
});
