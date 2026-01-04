describe('Navigation', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.viewport(1280, 900);
  });

  describe('Direct URL Access', () => {
    it('loads dashboard at root URL', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Check dashboard loaded - hero card should be visible
      cy.get('.hero-card').should('be.visible');
    });

    it('loads receive page directly', () => {
      cy.visit('/receive');

      cy.contains('h1', 'Receive Payment').should('be.visible');
    });

    it('loads send page directly', () => {
      cy.visit('/send');

      cy.contains('h1', 'Send Payment').should('be.visible');
    });

    it('loads payments page directly', () => {
      cy.visit('/payments');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('h1', 'Payments').should('be.visible');
    });

    it('loads channels page directly', () => {
      cy.intercept('GET', '**/api/node/channels', { fixture: 'channels.json' }).as('getChannels');
      cy.visit('/channels');
      cy.wait('@getChannels');

      cy.contains('h1', 'Channels').should('be.visible');
    });

    it('loads tools page directly', () => {
      cy.visit('/tools');

      cy.contains('h1', 'Tools').should('be.visible');
    });

    it('loads lnurl page directly', () => {
      cy.visit('/lnurl');

      cy.contains('h1', 'LNURL').should('be.visible');
    });
  });

  describe('Navigation Links', () => {
    it('navigates from dashboard to receive via quick actions', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Use the quick action link (visible on desktop)
      cy.get('a[href*="/receive"]').first().click({ force: true });
      cy.url().should('include', '/receive');
    });

    it('navigates from dashboard to send via quick actions', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Use the quick action link (visible on desktop)
      cy.get('a[href*="/send"]').first().click({ force: true });
      cy.url().should('include', '/send');
    });
  });

  describe('Browser Navigation', () => {
    it('browser back button works', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.visit('/receive');
      cy.contains('h1', 'Receive Payment').should('be.visible');

      cy.go('back');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  describe('Mobile Navigation', () => {
    it('displays navigation on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Should have bottom navigation or sidebar
      cy.get('nav').should('exist');
    });

    it('can navigate on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Navigate to receive
      cy.get('a[href*="/receive"]').first().click({ force: true });
      cy.url().should('include', '/receive');
    });
  });
});
