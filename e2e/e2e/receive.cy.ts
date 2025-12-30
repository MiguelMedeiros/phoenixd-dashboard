describe('Receive Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.visit('/receive');
  });

  describe('Page Load', () => {
    it('displays the receive page header', () => {
      cy.contains('h1', 'Receive Payment').should('be.visible');
      cy.contains('Create invoices or offers').should('be.visible');
    });

    it('shows Invoice and Offer tabs', () => {
      cy.contains('Invoice').should('be.visible');
      cy.contains('Offer').should('be.visible');
    });

    it('shows Invoice tab content by default', () => {
      cy.contains('Create Invoice').should('be.visible');
      cy.contains('Bolt11').should('be.visible');
    });
  });

  describe('Create Invoice', () => {
    it('has amount input field', () => {
      cy.get('input[type="number"]').should('be.visible');
    });

    it('has description textarea', () => {
      cy.get('textarea').should('be.visible');
    });

    it('has Create Invoice button', () => {
      cy.contains('button', 'Create Invoice').should('be.visible');
    });

    it('button is disabled without amount', () => {
      cy.contains('button', 'Create Invoice').should('be.disabled');
    });

    it('creates an invoice with amount', () => {
      cy.get('input[type="number"]').type('1000');
      cy.get('textarea').type('Test payment');

      cy.contains('button', 'Create Invoice').click();

      cy.wait('@createInvoice');

      // Should show QR code
      cy.get('svg').should('exist');
      // Should show the invoice string starting with lnbc
      cy.contains('lnbc').should('be.visible');
    });

    it('shows Copy Invoice button after creation', () => {
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Create Invoice').click();
      cy.wait('@createInvoice');

      cy.contains('button', 'Copy Invoice').should('be.visible');
    });

    it('copies invoice to clipboard', () => {
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Create Invoice').click();
      cy.wait('@createInvoice');

      cy.contains('button', 'Copy Invoice').click();
      cy.contains('Copied').should('be.visible');
    });
  });

  describe('Create Offer (BOLT12)', () => {
    it('switches to Offer tab', () => {
      cy.contains('button', 'Offer').click();
      cy.contains('Create Offer').should('be.visible');
      cy.contains('Bolt12').should('be.visible');
    });

    it('creates a BOLT12 offer', () => {
      cy.contains('button', 'Offer').click();
      cy.get('textarea').type('My reusable offer');
      cy.contains('button', 'Create Offer').click();

      cy.wait('@createOffer');

      // Should show the offer string starting with lno
      cy.contains('lno').should('be.visible');
    });
  });

  describe('No Invoice State', () => {
    it('shows empty state before creating invoice', () => {
      cy.contains('No Invoice Yet').should('be.visible');
      cy.contains('Fill in the amount').should('be.visible');
    });
  });

  describe('Invoice Creation Errors', () => {
    it('shows error when invoice creation fails', () => {
      cy.intercept('POST', '**/api/phoenixd/createinvoice', {
        statusCode: 500,
        body: { error: 'Failed to create invoice' },
      }).as('createInvoiceError');

      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Create Invoice').click();

      cy.wait('@createInvoiceError');
      // Should show error toast or message (check for toast content)
      cy.get('[role="alert"], [data-state="open"]', { timeout: 5000 }).should('exist');
    });

    it('handles large amount invoice', () => {
      cy.intercept('POST', '**/api/phoenixd/createinvoice', (req) => {
        // amountSat is sent as string in the request body
        expect(Number(req.body.amountSat)).to.equal(1000000);
        req.reply({
          statusCode: 200,
          body: {
            amountSat: 1000000,
            paymentHash: 'largeamount1234567890abcdef1234567890abcdef1234567890abcdef',
            serialized: 'lnbc10m1pjtest...',
          },
        });
      }).as('createLargeInvoice');

      cy.get('input[type="number"]').type('1000000');
      cy.contains('button', 'Create Invoice').click();

      cy.wait('@createLargeInvoice');
      cy.contains('lnbc').should('be.visible');
    });
  });

  describe('Offer Creation Errors', () => {
    it('shows error when offer creation fails', () => {
      cy.intercept('POST', '**/api/phoenixd/createoffer', {
        statusCode: 500,
        body: { error: 'Failed to create offer' },
      }).as('createOfferError');

      cy.contains('button', 'Offer').click();
      cy.get('textarea').type('My offer');
      cy.contains('button', 'Create Offer').click();

      cy.wait('@createOfferError');
      // Should show error toast or message
      cy.get('[role="alert"], [data-state="open"]', { timeout: 5000 }).should('exist');
    });

    it('creates offer without amount (variable amount offer)', () => {
      cy.intercept('POST', '**/api/phoenixd/createoffer', (req) => {
        // Offer can be created without amount
        expect(req.body.description).to.equal('Variable amount offer');
        req.reply({
          statusCode: 200,
          body: { offer: 'lno1variableamount...' },
        });
      }).as('createOfferNoAmount');

      cy.contains('button', 'Offer').click();
      cy.get('textarea').type('Variable amount offer');
      cy.contains('button', 'Create Offer').click();

      cy.wait('@createOfferNoAmount');
      cy.contains('lno').should('be.visible');
    });
  });

  describe('QR Code Display', () => {
    it('displays QR code after invoice creation', () => {
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Create Invoice').click();
      cy.wait('@createInvoice');

      // QR code should be rendered as SVG
      cy.get('svg').should('be.visible');
    });

    it('QR code updates when new invoice is created', () => {
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Create Invoice').click();
      cy.wait('@createInvoice');

      // Clear and create new invoice
      cy.get('input[type="number"]').clear().type('2000');

      cy.intercept('POST', '**/api/phoenixd/createinvoice', {
        statusCode: 200,
        body: {
          amountSat: 2000,
          paymentHash: 'newhash1234567890abcdef1234567890abcdef1234567890abcdef12345',
          serialized: 'lnbc20u1pjnewtest...',
        },
      }).as('createNewInvoice');

      cy.contains('button', 'Create Invoice').click();
      cy.wait('@createNewInvoice');

      cy.contains('lnbc20u').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/receive');

      cy.contains('h1', 'Receive Payment').should('be.visible');
      cy.contains('button', 'Create Invoice').should('be.visible');
    });

    it('displays correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/receive');

      cy.contains('h1', 'Receive Payment').should('be.visible');
      cy.contains('button', 'Create Invoice').should('be.visible');
    });
  });
});
