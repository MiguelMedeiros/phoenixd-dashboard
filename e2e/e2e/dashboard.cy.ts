describe('Dashboard Overview', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    // Use larger viewport to avoid clipping issues
    cy.viewport(1280, 900);
  });

  describe('Page Load', () => {
    it('displays the dashboard with balance section', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels', '@getIncomingPayments', '@getOutgoingPayments']);

      // Check balance section exists
      cy.contains('Lightning Balance').should('be.visible');
    });

    it('displays the balance amount', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Balance from fixture is 400,000 - check for formatted number
      cy.get('.hero-card, [class*="hero"]').should('contain', '400');
    });

    it('displays stat cards', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.contains('Channels').should('exist');
      cy.contains('Capacity').should('exist');
      cy.contains('Inbound').should('exist');
      cy.contains('Fee Credit').should('exist');
    });

    it('shows loading state initially', () => {
      cy.intercept('GET', '**/api/node/info', {
        fixture: 'node-info.json',
        delay: 500,
      }).as('getNodeInfoDelayed');

      cy.visit('/');
      cy.get('.animate-pulse').should('exist');
    });
  });

  describe('Hero Section', () => {
    it('has Receive button', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card, [class*="hero"]').contains('Receive').should('be.visible');
    });

    it('has Send button', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card, [class*="hero"]').contains('Send').should('be.visible');
    });

    it('Receive button navigates to receive page', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card, [class*="hero"]').contains('Receive').click();
      cy.url().should('include', '/receive');
    });

    it('Send button navigates to send page', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.get('.hero-card, [class*="hero"]').contains('Send').click();
      cy.url().should('include', '/send');
    });
  });

  describe('Recent Payments', () => {
    it('displays recent payments section', () => {
      cy.visit('/');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('body').should('contain', 'Recent Payments');
    });

    it('has View All link', () => {
      cy.visit('/');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('body').should('contain', 'View All');
    });

    it('View All navigates to payments page', () => {
      cy.visit('/');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('View All').scrollIntoView().click();
      cy.url().should('include', '/payments');
    });
  });

  describe('Node Info', () => {
    it('displays node information section', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo']);

      cy.get('body').should('contain', 'Node Info');
    });

    it('displays version from fixture', () => {
      cy.visit('/');
      cy.wait(['@getNodeInfo']);

      cy.get('body').should('contain', '0.4.1');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.contains('Lightning Balance').should('be.visible');
    });

    it('displays correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      cy.contains('Lightning Balance').should('be.visible');
    });
  });
});
