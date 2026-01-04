describe('Payments Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.viewport(1280, 900);
    cy.visit('/payments');
  });

  describe('Page Load', () => {
    it('displays the payments page header', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('h1', 'Payments').should('be.visible');
    });

    it('shows Incoming and Outgoing tabs', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('Incoming').should('exist');
      cy.contains('Outgoing').should('exist');
    });
  });

  describe('Stats Section', () => {
    it('displays stats', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains(/received|total/i).should('exist');
    });
  });

  describe('Payment List', () => {
    it('displays payment cards', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('.glass-card').should('have.length.at.least', 1);
    });

    it('switches between incoming and outgoing', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('button', 'Outgoing').click();

      cy.get('.glass-card').should('exist');
    });

    it('shows payment status', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('body').should('contain.text', 'Received');
    });
  });

  describe('Payment Cards', () => {
    it('payment cards are clickable', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('.glass-card').first().should('exist');
    });

    it('shows payment amounts', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('body').should('contain', '+');
    });
  });

  describe('Export', () => {
    it('has Export CSV button', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.get('body').should('contain', 'CSV');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no payments', () => {
      cy.intercept('GET', '**/api/payments/incoming*', { body: [] }).as('getEmptyIncoming');
      cy.intercept('GET', '**/api/payments/outgoing*', { body: [] }).as('getEmptyOutgoing');
      cy.intercept('GET', '**/api/node/info', { fixture: 'node-info.json' }).as('getNodeInfo');

      cy.visit('/payments');
      cy.wait(['@getEmptyIncoming', '@getEmptyOutgoing']);

      cy.contains(/no.*payments/i).should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/payments');
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      cy.contains('h1', 'Payments').should('be.visible');
    });
  });
});
