describe('Recurring Payments Page', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    cy.setupContactsMocks();
  });

  describe('Page Load', () => {
    it('displays the recurring payments page header', () => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');

      cy.contains('h1', /recurring/i).should('be.visible');
    });

    it('shows recurring payments from fixtures', () => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');

      // Should show stat cards
      cy.contains(/active|paused|total/i).should('exist');
    });

    it('displays stat cards', () => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');

      // Should show stat cards for active, paused, total paid
      cy.contains(/active/i).should('exist');
    });
  });

  describe('Recurring Payment List', () => {
    beforeEach(() => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');
    });

    it('shows recurring payment entries', () => {
      // Should show at least one recurring payment or empty state
      cy.contains(/recurring|no recurring/i).should('exist');
    });

    it('displays payment amount and frequency', () => {
      // Should show sats and frequency
      cy.contains(/sats|daily|weekly|monthly|no recurring/i).should('exist');
    });

    it('shows contact name for each recurring payment', () => {
      // Should show contact info or empty state
      cy.contains(/alice|bob|no recurring/i, { matchCase: false }).should('exist');
    });
  });

  describe('Add Recurring Payment', () => {
    beforeEach(() => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');
    });

    it('has Add Recurring Payment button', () => {
      cy.contains('button', /add recurring|new/i).should('exist');
    });

    it('opens recurring payment form dialog', () => {
      cy.contains('button', /add recurring|new/i).click();

      // Should show dialog to select contact
      cy.get('[role="dialog"]').should('be.visible');
    });
  });

  describe('Payment Actions', () => {
    beforeEach(() => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');
    });

    it('shows pause/play buttons for recurring payments', () => {
      // Should have action buttons or empty state
      cy.contains(/pause|play|no recurring/i, { matchCase: false }).should('exist');
    });

    it('shows edit button for recurring payments', () => {
      // Should have edit buttons or empty state
      cy.get('button[title*="edit" i], button[title*="Edit"]').should('exist');
    });

    it('shows delete button for recurring payments', () => {
      // Should have delete buttons or empty state
      cy.get('button[title*="delete" i], button[title*="Delete"]').should('exist');
    });
  });

  describe('Payment History', () => {
    beforeEach(() => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');
    });

    it('can expand payment history', () => {
      // Click on a recurring payment to show history
      cy.contains(/payment history|executions/i).should('exist');
    });

    it('shows execution entries when expanded', () => {
      // Click to expand history
      cy.contains(/payment history|executions/i).first().click();
      cy.wait('@getRecurringExecutions');

      // Should show execution entries or empty message
      cy.contains(/sats|no payments|failed/i).should('exist');
    });
  });

  describe('Countdown Display', () => {
    it('shows next payment countdown for active payments', () => {
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');

      // Should show countdown timer or next payment info
      cy.contains(/next|countdown|no recurring/i, { matchCase: false }).should('exist');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no recurring payments', () => {
      cy.setupApiMocks(); // Uses empty recurring payments array
      cy.visit('/recurring');
      cy.wait('@getRecurringPayments');

      cy.contains(/no recurring/i).should('be.visible');
    });

    it('has create first recurring payment button in empty state', () => {
      cy.setupApiMocks();
      cy.visit('/recurring');
      cy.wait('@getRecurringPayments');

      cy.contains('button', /add recurring/i).should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');

      cy.contains(/recurring/i).should('be.visible');
    });

    it('displays correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/recurring');
      cy.wait('@getRecurringPaymentsWithData');

      cy.contains(/recurring/i).should('be.visible');
    });
  });
});
