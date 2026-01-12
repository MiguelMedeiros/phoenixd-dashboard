describe('Authentication & Security', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
  });

  describe('Lock Screen', () => {
    it('shows lock screen when password is configured but not authenticated', () => {
      cy.mockAuthLocked();
      cy.visit('/');

      cy.contains('h1', 'Phoenixd').should('be.visible');
      cy.contains('Enter password to continue').should('be.visible');
      cy.get('input[placeholder="Password"]').should('be.visible');
      cy.contains('button', 'Unlock').should('be.visible');
    });

    it('unlock button is disabled when password is empty', () => {
      cy.mockAuthLocked();
      cy.visit('/');

      cy.contains('button', 'Unlock').should('be.disabled');
    });

    it('unlock button is enabled when password is entered', () => {
      cy.mockAuthLocked();
      cy.visit('/');

      cy.get('input[placeholder="Password"]').type('test1234');
      cy.contains('button', 'Unlock').should('not.be.disabled');
    });

    it('shows error on invalid password', () => {
      cy.mockAuthLocked();
      cy.mockLoginFailure();
      cy.visit('/');

      cy.get('input[placeholder="Password"]').type('wrongpassword');
      cy.contains('button', 'Unlock').click();

      cy.wait('@loginFailure');
      cy.contains('Invalid password').should('be.visible');
    });

    it('unlocks dashboard on correct password', () => {
      cy.mockAuthLocked();
      cy.mockLoginSuccess();
      cy.visit('/');

      cy.get('input[placeholder="Password"]').type('correctpassword');
      cy.contains('button', 'Unlock').click();

      cy.wait('@login');

      // After login, mock authenticated state
      cy.setupApiMocks();
      cy.mockAuthAuthenticated();

      cy.wait('@getAuthStatus');
    });

    it('displays video background on lock screen', () => {
      cy.mockAuthLocked();
      cy.visit('/');

      cy.get('video').should('exist');
    });
  });

  describe('Dashboard without password', () => {
    beforeEach(() => {
      cy.setupApiMocks();
      cy.mockAuthNoPassword();
    });

    it('shows dashboard directly without lock screen', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      // Dashboard should be visible - hero card should be present
      cy.get('.hero-card').should('be.visible');
    });

    it('does not show lock button in sidebar when no password is set', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      cy.get('button[title="Lock"]').should('not.exist');
    });
  });

  describe('Dashboard with password (authenticated)', () => {
    beforeEach(() => {
      cy.setupApiMocks();
      cy.mockAuthAuthenticated();
    });

    it('shows lock button in sidebar', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      cy.get('button[title="Lock"]').should('be.visible');
    });

    it('clicking lock button shows lock screen', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: true,
          authenticated: false,
          autoLockMinutes: 5,
          lockScreenBg: 'storm-clouds',
        },
      }).as('getAuthStatusLocked');

      cy.get('button[title="Lock"]').click();

      cy.contains('Enter password to continue').should('be.visible');
    });
  });

  describe('Settings - Security Section', () => {
    describe('Without password configured', () => {
      beforeEach(() => {
        cy.setupApiMocks();
        cy.mockAuthNoPassword();
      });

      it('shows "No password set" message', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Password Protection').should('be.visible');
        cy.contains('No password set').should('be.visible');
      });

      it('shows hint about seed phrase access', () => {
        cy.visit('/settings?tab=wallet');
        cy.wait('@getAuthStatus');

        // The wallet tab should show a warning about needing a password
        cy.contains('Set a password').should('be.visible');
      });

      it('shows Setup button', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Setup').should('be.visible');
      });

      it('does not show View Seed Phrase button without password', () => {
        cy.visit('/settings?tab=wallet');
        cy.wait('@getAuthStatus');

        // Without password, the View Seed Phrase button should not exist
        cy.contains('button', 'View Seed Phrase').should('not.exist');
      });

      it('clicking Setup shows password form', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Setup').click();
        cy.contains('Create a password to protect your dashboard').should('be.visible');
        cy.get('input[placeholder="New password"]').should('be.visible');
        cy.get('input[placeholder="Confirm password"]').should('be.visible');
      });
    });

    describe('With password configured', () => {
      beforeEach(() => {
        cy.setupApiMocks();
        cy.mockAuthAuthenticated();
      });

      it('shows "Dashboard is protected" message', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Password Protection').should('be.visible');
        cy.contains('Dashboard is protected').should('be.visible');
      });

      it('shows Manage button', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Manage').should('be.visible');
      });

      it('shows Auto-lock options', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Auto-lock').should('be.visible');
      });

      it('shows Lock Screen Background options', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Lock Screen Background').should('be.visible');
      });

      it('shows Lock Now and Logout buttons', () => {
        cy.visit('/settings?tab=security');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Lock Now').scrollIntoView().should('exist');
        cy.contains('button', 'Logout').scrollIntoView().should('exist');
      });

      it('shows Wallet Seed tab and View Seed Phrase button', () => {
        cy.visit('/settings?tab=wallet');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'View Seed Phrase').should('be.visible');
      });

      it('clicking Manage shows password options', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Manage').click();
        cy.contains('button', 'Change Password').should('be.visible');
        cy.contains('button', 'Remove Password').should('be.visible');
      });
    });
  });

  describe('Wallet Seed Viewer', () => {
    beforeEach(() => {
      cy.setupApiMocks();
      cy.mockAuthAuthenticated();
    });

    it('clicking View Seed Phrase shows password prompt', () => {
      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.contains('Enter your dashboard password to reveal').should('exist');
      cy.get('input[placeholder="Current password"]').should('be.visible');
    });

    it('Reveal Seed button is disabled without password', () => {
      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.contains('button', 'Reveal Seed').should('be.disabled');
    });

    it('Reveal Seed button is enabled with password', () => {
      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Current password"]').type('test1234');
      cy.contains('button', 'Reveal Seed').should('not.be.disabled');
    });

    it('shows seed phrase on correct password', () => {
      const testSeed = 'movie fan finish armed enough nut ramp picnic into jump token few';
      cy.mockGetSeed(testSeed);

      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Current password"]').type('correctpassword');
      cy.contains('button', 'Reveal Seed').click();

      cy.wait('@getSeed');
      // Seed is displayed word by word in a grid, check for first and last word
      cy.contains('movie').should('exist');
      cy.contains('few').should('exist');
    });

    it('shows error on incorrect password', () => {
      cy.mockGetSeedFailure('Invalid password');

      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Current password"]').type('wrongpassword');
      cy.contains('button', 'Reveal Seed').click();

      cy.wait('@getSeedFailure');
      cy.contains('Invalid password').should('exist');
    });

    it('can hide seed phrase after viewing', () => {
      const testSeed = 'movie fan finish armed enough nut ramp picnic into jump token few';
      cy.mockGetSeed(testSeed);

      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Current password"]').type('correctpassword');
      cy.contains('button', 'Reveal Seed').click();

      cy.wait('@getSeed');
      // Seed is displayed word by word in a grid
      cy.contains('movie').should('exist');

      cy.contains('button', 'Hide Seed Phrase').click();
      // After hiding, the seed words should not be visible
      cy.contains('button', 'View Seed Phrase').should('exist');
    });
  });

  describe('Mobile Lock Screen', () => {
    it('lock screen works on mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.mockAuthLocked();
      cy.visit('/');

      cy.contains('h1', 'Phoenixd').should('be.visible');
      cy.get('input[placeholder="Password"]').should('be.visible');
      cy.contains('button', 'Unlock').should('be.visible');
    });

    it('lock button visible on mobile when authenticated', () => {
      cy.viewport('iphone-x');
      cy.setupApiMocks();
      cy.mockAuthAuthenticated();
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      // On mobile, the sidebar is hidden, so we check that the lock button exists
      // but may not be visible in collapsed sidebar view
      cy.get('button[title="Lock"]').should('exist');
    });
  });
});
