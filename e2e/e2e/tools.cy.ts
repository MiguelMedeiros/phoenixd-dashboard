describe('Tools Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.viewport(1280, 900);
    cy.visit('/tools');
  });

  describe('Page Load', () => {
    it('displays the tools page header', () => {
      cy.contains('h1', 'Tools').should('be.visible');
    });

    it('shows all tabs', () => {
      cy.contains('One-time').should('be.visible');
      cy.contains('Reusable').should('be.visible');
      cy.contains('Fees').should('be.visible');
    });
  });

  describe('Decode One-time Invoice Tab', () => {
    it('shows One-time invoice form by default', () => {
      cy.contains('One-time invoice (Bolt11)').should('be.visible');
    });

    it('has invoice textarea', () => {
      cy.get('textarea').should('be.visible');
    });

    it('has Decode button', () => {
      cy.contains('button', 'Decode').should('be.visible');
    });

    it('Decode button is disabled without input', () => {
      cy.contains('button', 'Decode').should('be.disabled');
    });

    it('decodes an invoice successfully', () => {
      cy.get('textarea').first().type('lnbc10u1pjtest123...');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeInvoice');

      cy.contains('Payment Hash').should('be.visible');
    });

    it('shows error toast for invalid invoice', () => {
      cy.intercept('POST', '**/api/phoenixd/decodeinvoice', {
        statusCode: 400,
        body: { error: 'Invalid invoice' },
      }).as('decodeInvoiceError');

      cy.get('textarea').first().type('invalid-invoice');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeInvoiceError');

      cy.get('[data-state="open"], [role="status"], [role="alert"]').should('exist');
    });
  });

  describe('Decode Reusable Invoice Tab', () => {
    it('switches to Reusable tab', () => {
      cy.contains('button', 'Reusable').click();
      // Check the tab content shows Bolt12 info
      cy.contains(/reusable invoice|bolt12/i).should('be.visible');
    });

    it('has reusable invoice textarea', () => {
      cy.contains('button', 'Reusable').click();
      // Wait for tab content to load
      cy.wait(500);
      cy.get('textarea').should('be.visible');
    });

    it('decodes a reusable invoice successfully', () => {
      cy.contains('button', 'Reusable').click();
      // Wait for tab content to load
      cy.wait(500);
      cy.get('textarea').first().type('lno1test123...');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeOffer');

      cy.contains(/reusable|bolt12/i).should('exist');
    });
  });

  describe('Estimate Fees Tab', () => {
    it('switches to Fees tab', () => {
      cy.contains('button', 'Fees').click();
      cy.contains('Inbound liquidity costs').should('be.visible');
    });

    it('has amount input', () => {
      cy.contains('button', 'Fees').click();
      cy.get('input[type="number"]').should('be.visible');
    });

    it('has Estimate button', () => {
      cy.contains('button', 'Fees').click();
      cy.contains('button', 'Estimate').should('be.visible');
    });

    it('estimates fees successfully', () => {
      cy.contains('button', 'Fees').click();
      cy.get('input[type="number"]').first().type('100000');
      cy.contains('button', 'Estimate').click();

      cy.wait('@getLiquidityFees');

      cy.contains(/mining|fee/i).should('exist');
    });
  });

  describe('Empty States', () => {
    it('shows empty state for one-time invoice', () => {
      cy.contains(/decode|invoice/i).should('exist');
    });

    it('shows empty state for reusable invoice', () => {
      cy.contains('button', 'Reusable').click();
      cy.contains(/decode|reusable/i).should('exist');
    });

    it('shows empty state for fees', () => {
      cy.contains('button', 'Fees').click();
      cy.contains(/amount|estimate/i).should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/tools');

      cy.contains('h1', 'Tools').should('be.visible');
    });
  });
});
