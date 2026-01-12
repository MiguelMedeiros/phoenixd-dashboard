describe('Dashboard Overview', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.viewport(1280, 900);
  });

  describe('Page Load', () => {
    it('displays the dashboard with hero card', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card').should('be.visible');
    });

    it('displays the balance amount', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Wait for balance to be displayed - the header always shows balance
      // Balance from fixture (400,000 sats) - formatted as "400.0k sats"
      cy.contains('400').should('exist');
      cy.contains('sats').should('exist');
    });

    it('displays stat cards on desktop', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Stats are only visible on desktop (hidden md:block)
      cy.get('.glass-card').should('have.length.at.least', 4);
    });

    it('shows loading skeleton initially', () => {
      cy.intercept('GET', '**/api/node/info', {
        fixture: 'node-info.json',
        delay: 500,
      }).as('getNodeInfoDelayed');

      cy.visit('/');
      cy.get('.animate-pulse').should('exist');
    });
  });

  describe('Hero Section', () => {
    it('has Receive button on desktop', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Desktop layout (p-6) has Receive/Send buttons in hero
      cy.get('.hero-card.p-6').contains(/receive/i).should('be.visible');
    });

    it('has Send button on desktop', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card.p-6').contains(/send/i).should('be.visible');
    });

    it('Receive button navigates to receive page', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card.p-6').contains(/receive/i).click();
      cy.url().should('include', '/receive');
    });

    it('Send button navigates to send page', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card.p-6').contains(/send/i).click();
      cy.url().should('include', '/send');
    });
  });

  describe('Recent Payments', () => {
    it('displays recent payments section', () => {
      cy.visit('/');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('Recent Payments').should('exist');
    });

    it('has View All link', () => {
      cy.visit('/');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('View All').should('exist');
    });

    it('View All navigates to payments page', () => {
      cy.visit('/');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('View All').first().click({ force: true });
      cy.url().should('include', '/payments');
    });
  });

  describe('Node Info', () => {
    it('displays node information section on desktop', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo']);

      cy.contains('Node Info').should('exist');
    });

    it('displays version from fixture', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Scroll down to see Node Info section and wait for version to load
      cy.contains('Node Info').scrollIntoView().should('be.visible');
      // The version is displayed after node info loads
      cy.contains('0.4.1', { timeout: 15000 }).should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Mobile layout has hero-card with balance
      cy.get('.hero-card').should('be.visible');
      // Mobile shows Recent Payments
      cy.contains('Recent Payments').should('exist');
    });

    it('displays correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card').should('be.visible');
    });
  });
});
