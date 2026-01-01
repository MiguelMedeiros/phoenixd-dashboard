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

      cy.contains('Received').should('exist');
      cy.contains('Sent').should('exist');
      cy.contains('Fees').should('exist');
    });
  });

  describe('Payment List', () => {
    it('displays payment cards', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      // Should have payment cards
      cy.get('button.glass-card').should('have.length.at.least', 1);
    });

    it('switches between incoming and outgoing', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      // Switch to outgoing
      cy.contains('button', 'Outgoing').click();

      // Should still have content
      cy.get('button.glass-card').should('exist');
    });

    it('shows payment status badges', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      // Check for Received status from incoming
      cy.get('body').should('contain', 'Received');
    });
  });

  describe('Payment Cards', () => {
    it('payment cards are clickable', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      // Payment cards should be buttons (clickable)
      cy.get('button.glass-card').first().should('exist');
    });

    it('shows payment amounts', () => {
      cy.wait(['@getIncomingPayments', '@getOutgoingPayments']);

      // Should show + for incoming payments
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

      cy.visit('/payments');
      cy.wait(['@getEmptyIncoming', '@getEmptyOutgoing']);

      cy.contains('No incoming payments yet').should('be.visible');
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
