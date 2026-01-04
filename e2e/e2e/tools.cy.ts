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

  describe('Decode Offer Tab', () => {
    it('switches to Offer tab', () => {
      cy.contains('button', 'Offer').click();
      cy.contains('Decode Offer').should('be.visible');
    });

    it('has offer textarea', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea').should('be.visible');
    });

    it('decodes an offer successfully', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea').first().type('lno1test123...');
      cy.contains('button', 'Decode').click();

      cy.wait('@decodeOffer');

      cy.contains(/offer|bolt12/i).should('exist');
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
      cy.get('input[type="number"]').first().type('100000');
      cy.contains('button', 'Estimate').click();

      cy.wait('@getLiquidityFees');

      cy.contains(/mining|fee/i).should('exist');
    });
  });

  describe('Empty States', () => {
    it('shows empty state for invoice', () => {
      cy.contains(/decode|invoice/i).should('exist');
    });

    it('shows empty state for offer', () => {
      cy.contains('button', 'Offer').click();
      cy.contains(/decode|offer/i).should('exist');
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
