describe('Tools Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.visit('/tools');
  });

  describe('Page Load', () => {
    it('displays the tools page header', () => {
      cy.contains('h1', 'Tools').should('be.visible');
      cy.contains('Decode invoices, offers, and estimate fees').should('be.visible');
    });

    it('shows all tabs', () => {
      cy.contains('Invoice').should('be.visible');
      cy.contains('Offer').should('be.visible');
      cy.contains('Fees').should('be.visible');
    });
  });

  describe('Decode Invoice Tab', () => {
    it('shows Decode Invoice form by default', () => {
      cy.contains('Decode Invoice').should('be.visible');
    });

    it('has invoice textarea', () => {
      cy.get('textarea[placeholder*="lnbc"]').should('be.visible');
    });

    it('has Decode button', () => {
      cy.contains('button', 'Decode').should('be.visible');
    });

    it('Decode button is disabled without input', () => {
      cy.contains('button', 'Decode').should('be.disabled');
    });

    it('decodes an invoice successfully', () => {
      cy.get('textarea[placeholder*="lnbc"]').type('lnbc10u1pjtest123...');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeInvoice');

      cy.contains('Payment Hash').should('be.visible');
    });

    it('shows error toast for invalid invoice', () => {
      cy.intercept('POST', '**/api/phoenixd/decodeinvoice', {
        statusCode: 400,
        body: { error: 'Invalid invoice' },
      }).as('decodeInvoiceError');

      cy.get('textarea[placeholder*="lnbc"]').type('invalid-invoice');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeInvoiceError');

      // Toast should appear
      cy.get('[data-state="open"], [role="status"]').should('exist');
    });
  });

  describe('Decode Offer Tab', () => {
    it('switches to Offer tab', () => {
      cy.contains('button', 'Offer').click();
      cy.contains('Decode Offer').should('be.visible');
    });

    it('has offer textarea', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea[placeholder*="lno"]').should('be.visible');
    });

    it('decodes an offer successfully', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea[placeholder*="lno"]').type('lno1test123...');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeOffer');

      cy.contains('Valid Bolt12 Offer').should('be.visible');
    });
  });

  describe('Estimate Fees Tab', () => {
    it('switches to Fees tab', () => {
      cy.contains('button', 'Fees').click();
      cy.contains('Estimate Liquidity Fees').should('be.visible');
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
      cy.get('input[type="number"]').type('100000');
      cy.contains('button', 'Estimate').click();

      cy.wait('@getLiquidityFees');

      cy.contains('Mining Fee').should('be.visible');
      cy.contains('Service Fee').should('be.visible');
    });
  });

  describe('Empty States', () => {
    it('shows empty state for invoice', () => {
      cy.contains('Decode an invoice to see details').should('be.visible');
    });

    it('shows empty state for offer', () => {
      cy.contains('button', 'Offer').click();
      cy.contains('Decode an offer to see details').should('be.visible');
    });

    it('shows empty state for fees', () => {
      cy.contains('button', 'Fees').click();
      cy.contains('Enter an amount to estimate fees').should('be.visible');
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
