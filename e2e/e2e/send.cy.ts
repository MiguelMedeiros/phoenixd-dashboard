describe('Send Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.visit('/send');
  });

  describe('Page Load', () => {
    it('displays the send page header', () => {
      cy.contains('h1', 'Send Payment').should('be.visible');
      cy.contains('Pay invoices, offers, addresses').should('be.visible');
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
      cy.contains('Paste a Bolt11 invoice').should('be.visible');
    });

    it('has invoice textarea', () => {
      cy.get('textarea[placeholder*="lnbc"]').should('be.visible');
    });

    it('has Pay Invoice button', () => {
      cy.contains('button', 'Pay Invoice').should('be.visible');
    });

    it('successfully pays invoice', () => {
      cy.get('textarea[placeholder*="lnbc"]').type('lnbc10u1pjtest123...');
      cy.contains('button', 'Pay Invoice').click();

      cy.wait('@payInvoice');

      cy.contains('Payment Successful').should('be.visible');
    });
  });

  describe('Pay Offer Tab', () => {
    it('switches to Offer tab', () => {
      cy.contains('button', 'Offer').click();
      cy.contains('Pay Offer').should('be.visible');
      cy.contains('Bolt12 offer').should('be.visible');
    });

    it('has offer textarea and amount input', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea[placeholder*="lno"]').should('be.visible');
      cy.get('input[type="number"]').should('be.visible');
    });
  });

  describe('LN Address Tab', () => {
    it('switches to LN Address tab', () => {
      cy.contains('button', 'LN Address').click();
      cy.contains('Pay Lightning Address').should('be.visible');
    });

    it('has address input and amount input', () => {
      cy.contains('button', 'LN Address').click();
      cy.get('input[placeholder*="user@domain"]').should('be.visible');
      cy.get('input[type="number"]').should('be.visible');
    });

    it('successfully pays to LN Address', () => {
      cy.intercept('POST', '**/api/phoenixd/paylnaddress', {
        statusCode: 200,
        body: {
          recipientAmountSat: 1000,
          routingFeeSat: 5,
          paymentId: 'pay-ln-001',
          paymentHash: 'lnaddress1234567890abcdef1234567890abcdef1234567890abcdef1234',
          paymentPreimage: 'preimage1234567890abcdef1234567890abcdef1234567890abcdef12345',
        },
      }).as('payLnAddressSuccess');

      cy.contains('button', 'LN Address').click();
      cy.get('input[placeholder*="user@domain"]').type('user@getalby.com');
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Pay').click();

      cy.wait('@payLnAddressSuccess');
      // Check for success indicator - either text or success class
      cy.get('.text-success, [class*="success"]', { timeout: 5000 }).should('exist');
    });

    it('shows error when LN Address payment fails', () => {
      cy.intercept('POST', '**/api/phoenixd/paylnaddress', {
        statusCode: 500,
        body: { error: 'payment could not be sent through existing channels' },
      }).as('payLnAddressError');

      cy.contains('button', 'LN Address').click();
      cy.get('input[placeholder*="user@domain"]').type('user@getalby.com');
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Pay').click();

      cy.wait('@payLnAddressError');
      // Check for error indicator - toast or error class
      cy.get('.text-destructive, [class*="destructive"], [role="alert"]', {
        timeout: 5000,
      }).should('exist');
    });

    it('shows error for invalid LN Address format', () => {
      cy.intercept('POST', '**/api/phoenixd/paylnaddress', {
        statusCode: 500,
        body: { error: 'Invalid lightning address' },
      }).as('payLnAddressInvalid');

      cy.contains('button', 'LN Address').click();
      cy.get('input[placeholder*="user@domain"]').type('invalid-address');
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Pay').click();

      cy.wait('@payLnAddressInvalid');
      // Check for error indicator
      cy.get('.text-destructive, [class*="destructive"], [role="alert"]', {
        timeout: 5000,
      }).should('exist');
    });

    it('sends payment request with correct parameters', () => {
      cy.intercept('POST', '**/api/phoenixd/paylnaddress', (req) => {
        expect(req.body.address).to.equal('user@getalby.com');
        expect(Number(req.body.amountSat)).to.equal(500);
        req.reply({
          statusCode: 200,
          body: {
            recipientAmountSat: 500,
            routingFeeSat: 2,
            paymentId: 'pay-ln-002',
            paymentHash: 'hash123',
            paymentPreimage: 'preimage123',
          },
        });
      }).as('payLnAddressParams');

      cy.contains('button', 'LN Address').click();
      cy.get('input[placeholder*="user@domain"]').type('user@getalby.com');
      cy.get('input[type="number"]').type('500');
      cy.contains('button', 'Pay').click();

      cy.wait('@payLnAddressParams');
    });
  });

  describe('On-chain Tab', () => {
    it('switches to On-chain tab', () => {
      cy.contains('button', 'On-chain').click();
      cy.contains('Send On-chain').should('be.visible');
      cy.contains('regular address').should('be.visible');
    });

    it('has bitcoin address input', () => {
      cy.contains('button', 'On-chain').click();
      cy.get('input[placeholder*="bc1"]').should('be.visible');
    });

    it('has fee rate input', () => {
      cy.contains('button', 'On-chain').click();
      cy.contains('Fee Rate').should('be.visible');
    });
  });

  describe('Payment Result', () => {
    it('shows success message after payment', () => {
      cy.get('textarea[placeholder*="lnbc"]').type('lnbc10u1pjtest...');
      cy.contains('button', 'Pay Invoice').click();

      cy.wait('@payInvoice');

      cy.contains('Payment Successful').should('be.visible');
      cy.get('.text-success').should('exist');
    });

    it('shows error message on payment failure', () => {
      cy.intercept('POST', '**/api/phoenixd/payinvoice', {
        statusCode: 400,
        body: { error: 'Insufficient balance' },
      }).as('payInvoiceError');

      cy.get('textarea[placeholder*="lnbc"]').type('lnbc10u1pjtest...');
      cy.contains('button', 'Pay Invoice').click();

      cy.wait('@payInvoiceError');

      cy.contains('Payment Failed').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/send');

      cy.contains('h1', 'Send Payment').should('be.visible');
    });
  });
});
