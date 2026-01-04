describe('Send Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.viewport(1280, 900);
    cy.visit('/send');
  });

  describe('Page Load', () => {
    it('displays the send page header', () => {
      cy.contains('h1', 'Send Payment').should('be.visible');
    });

    it('shows all payment type tabs', () => {
      cy.contains('Invoice').should('be.visible');
      cy.contains('Offer').should('be.visible');
      cy.contains('LN Address').should('be.visible');
      cy.contains('On-chain').should('be.visible');
    });
  });

  describe('Pay Invoice Tab', () => {
    it('shows Pay Invoice form by default', () => {
      cy.contains('Pay Invoice').should('be.visible');
    });

    it('has invoice textarea', () => {
      cy.get('textarea').should('be.visible');
    });

    it('has Pay Invoice button', () => {
      cy.contains('button', /pay invoice/i).should('be.visible');
    });

    it('successfully pays invoice', () => {
      cy.get('textarea').first().type('lnbc1000n1test');
      cy.contains('button', /pay/i).first().click();
      cy.wait('@payInvoice');
      // Check for success state
      cy.contains(/success|paid/i).should('exist');
    });
  });

  describe('Pay Offer Tab', () => {
    it('switches to Offer tab', () => {
      cy.contains('button', 'Offer').click();
      cy.contains('Pay Offer').should('be.visible');
    });

    it('has offer textarea and amount input', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea').should('be.visible');
      cy.get('input[inputmode="numeric"]').should('be.visible');
    });
  });

  describe('LN Address Tab', () => {
    it('switches to LN Address tab', () => {
      // Find tab by looking for third button in tabs (Address tab)
      cy.get('.glass-card button').eq(2).click();
      // Should show form with input fields
      cy.get('form input').should('have.length.at.least', 2);
    });

    it('has address input and amount input', () => {
      cy.get('.glass-card button').eq(2).click();
      // Has input fields for address and amount
      cy.get('form input').should('have.length.at.least', 2);
    });

    it('successfully pays to LN Address', () => {
      cy.get('.glass-card button').eq(2).click();
      
      // Fill in address
      cy.get('form input').first().type('test@example.com');
      // Fill in amount (inputmode numeric)
      cy.get('form input[inputmode="numeric"]').first().type('1000');
      
      cy.contains('button', /pay/i).click();
      cy.wait('@payLnAddress');
      cy.contains(/success|paid/i).should('exist');
    });
  });

  describe('On-chain Tab', () => {
    it('switches to On-chain tab', () => {
      cy.contains('button', 'On-chain').click();
      cy.contains(/bitcoin|on-chain/i).should('exist');
    });

    it('has address and amount inputs', () => {
      cy.contains('button', 'On-chain').click();
      cy.get('input').should('have.length.at.least', 2);
    });
  });

  describe('Payment Result', () => {
    it('shows success message on successful payment', () => {
      cy.get('textarea').first().type('lnbc1000n1test');
      cy.contains('button', /pay/i).first().click();
      cy.wait('@payInvoice');
      cy.contains(/success|paid/i).should('exist');
    });

    it('shows error on failed payment', () => {
      cy.intercept('POST', '**/api/phoenixd/payinvoice', {
        statusCode: 500,
        body: { error: 'Payment failed' },
      }).as('payInvoiceFail');

      cy.get('textarea').first().type('lnbc1000n1test');
      cy.contains('button', /pay/i).first().click();
      cy.wait('@payInvoiceFail');
      cy.get('[role="alert"], [data-state="open"]', { timeout: 5000 }).should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/send');

      cy.contains('h1', 'Send Payment').should('be.visible');
    });

    it('displays correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/send');

      cy.contains('h1', 'Send Payment').should('be.visible');
    });
  });
});
