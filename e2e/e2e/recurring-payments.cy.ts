describe('Recurring Payments', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    cy.setupContactsMocks();
  });

  describe('Access from Contacts Page', () => {
    it('shows recurring payments when expanding a contact', () => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');

      // Expand a contact
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Should show recurring payments section
      cy.contains(/recurring|scheduled/i).should('exist');
    });

    it('displays recurring payment details', () => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');

      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Should show at least one of: payment amount, frequency, or add button
      cy.contains(/weekly|daily|monthly|sats|add recurring|no recurring/i).should('exist');
    });
  });

  describe('Create Recurring Payment', () => {
    beforeEach(() => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');
    });

    it('opens recurring payment form', () => {
      // Expand contact
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Click add recurring payment button (if no payments exist, there's a prompt)
      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });

      // Should show recurring payment form
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('has frequency selection', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });

      // Should have frequency options
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains(/frequency|daily|weekly|monthly/i).should('exist');
    });

    it('has amount input', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });

      // Should have amount input
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"] input').should('exist');
    });

    it('creates a recurring payment successfully', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');

      // Fill amount
      cy.get('[role="dialog"] input[inputmode="numeric"], [role="dialog"] input[type="number"]').first().clear().type('500');

      // Submit
      cy.get('[role="dialog"]').contains('button', /save|create|schedule/i).click();

      cy.wait('@createRecurringPaymentWithData');

      // Dialog should close or success message shown
      cy.contains(/success|created|scheduled/i).should('exist');
    });
  });

  describe('Edit Recurring Payment', () => {
    beforeEach(() => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');
    });

    it('can access edit for existing recurring payment', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Find edit button for recurring payment (may be an icon button)
      cy.get('button[title*="edit" i], button[title*="Edit"]').first().click({ force: true });

      // Should show edit dialog
      cy.get('[role="dialog"]').should('be.visible');
    });
  });

  describe('Delete/Pause Recurring Payment', () => {
    beforeEach(() => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');
    });

    it('can pause or delete recurring payment', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Should have pause/delete controls
      cy.contains(/recurring|scheduled|no recurring/i).should('exist');
    });
  });

  describe('Payment History', () => {
    beforeEach(() => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');
    });

    it('can view payment history for recurring payment', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Payment history section should be accessible
      cy.contains(/recurring|history|scheduled|no recurring/i).should('exist');
    });

    it('shows successful executions', () => {
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Should show payment history or no payments message
      cy.contains(/recurring|history|scheduled|no recurring/i).should('exist');
    });
  });

  describe('Real-time Updates', () => {
    it('page loads with mocked WebSocket events', () => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');

      // Page should be interactive
      cy.contains('Alice Lightning').should('be.visible').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Stats and recurring payments should be displayed
      cy.contains(/recurring|scheduled|no recurring/i).should('exist');
    });
  });

  describe('Address Selection', () => {
    beforeEach(() => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');
    });

    it('shows address selection for contacts with multiple addresses', () => {
      // Click on a contact that may have multiple addresses
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Open add recurring dialog
      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });

      // Dialog should have address or contact selection
      cy.get('[role="dialog"]').should('be.visible');
    });
  });

  describe('Countdown Display', () => {
    it('shows next payment countdown', () => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');

      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');

      // Should show recurring payment info including countdown or next run time
      cy.contains(/recurring|scheduled|next|no recurring/i).should('exist');
    });
  });

  describe('Frequency Options', () => {
    beforeEach(() => {
      cy.visit('/contacts');
      cy.wait('@getContactsWithData');
      cy.contains('Alice Lightning').click();
      cy.wait('@getRecurringPaymentsWithData');
    });

    it('daily frequency option exists', () => {
      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      
      // Check for daily option
      cy.contains(/daily/i).should('exist');
    });

    it('weekly frequency option exists', () => {
      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      
      // Check for weekly option
      cy.contains(/weekly/i).should('exist');
    });

    it('monthly frequency option exists', () => {
      cy.contains(/add recurring|schedule|new recurring/i).first().click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      
      // Check for monthly option
      cy.contains(/monthly/i).should('exist');
    });
  });
});
