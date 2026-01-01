describe('LNURL Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.visit('/lnurl');
  });

  describe('Page Load', () => {
    it('displays the LNURL page header', () => {
      cy.contains('h1', 'LNURL').should('be.visible');
      cy.contains('Pay, withdraw, and authenticate').should('be.visible');
    });

    it('shows all tabs', () => {
      cy.contains('Pay').should('exist');
      cy.contains('Withdraw').should('exist');
      cy.contains('Auth').should('exist');
    });
  });

  describe('LNURL-Pay Tab', () => {
    it('shows LNURL-Pay form by default', () => {
      cy.contains('LNURL-Pay').should('be.visible');
    });

    it('has form inputs', () => {
      cy.get('input').should('have.length.at.least', 2);
    });

    it('has Pay via LNURL button', () => {
      cy.contains('button', 'Pay via LNURL').should('be.visible');
    });

    it('successfully pays via LNURL', () => {
      cy.viewport(1280, 900);
      cy.get('input').first().type('lnurl1test...');
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Pay via LNURL').click();

      cy.wait('@lnurlPay');

      cy.get('body').should('contain', 'Success');
    });
  });

  describe('LNURL-Withdraw Tab', () => {
    it('switches to Withdraw tab', () => {
      cy.contains('button', 'Withdraw').click();
      cy.contains('LNURL-Withdraw').should('be.visible');
    });

    it('successfully withdraws via LNURL', () => {
      cy.contains('button', 'Withdraw').click();
      cy.get('input').first().type('lnurl1withdraw...');
      cy.get('form').contains('button', 'Withdraw').click();

      cy.wait('@lnurlWithdraw');

      cy.contains('Success').should('be.visible');
    });
  });

  describe('LNURL-Auth Tab', () => {
    it('switches to Auth tab', () => {
      cy.contains('button', 'Auth').click();
      cy.contains('LNURL-Auth').should('be.visible');
    });

    it('has Authenticate button', () => {
      cy.contains('button', 'Auth').click();
      cy.contains('button', 'Authenticate').should('be.visible');
    });

    it('successfully authenticates via LNURL', () => {
      cy.contains('button', 'Auth').click();
      cy.get('input').first().type('lnurl1auth...');
      cy.contains('button', 'Authenticate').click();

      cy.wait('@lnurlAuth');

      cy.contains('Success').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('shows error on failure', () => {
      cy.viewport(1280, 900);
      cy.intercept('POST', '**/api/lnurl/pay', {
        statusCode: 400,
        body: { error: 'Invalid LNURL' },
      }).as('lnurlPayError');

      cy.get('input').first().type('invalid');
      cy.get('input[type="number"]').type('1000');
      cy.contains('button', 'Pay via LNURL').click();

      cy.wait('@lnurlPayError');

      cy.get('body').should('contain', 'Failed');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/lnurl');

      cy.contains('h1', 'LNURL').should('be.visible');
    });
  });
});
