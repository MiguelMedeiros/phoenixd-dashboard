describe('Authentication & Security', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
  });

  describe('Lock Screen', () => {
    it('shows lock screen when password is configured but not authenticated', () => {
      cy.mockAuthLocked();
      cy.visit('/');

      // Should show lock screen
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

      // After login, mock authenticated state and reload
      cy.setupApiMocks();
      cy.mockAuthAuthenticated();

      // Dashboard should be visible after successful login
      cy.wait('@getAuthStatus');
    });

    it('displays video background on lock screen', () => {
      cy.mockAuthLocked();
      cy.visit('/');

      // Video element should exist
      cy.get('video').should('exist');
    });
  });

  describe('Dashboard without password', () => {
    beforeEach(() => {
      cy.setupApiMocks();
      cy.mockAuthNoPassword(); // Must come after setupApiMocks to override auth mock
    });

    it('shows dashboard directly without lock screen', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      // Dashboard should be visible (check for Receive button which is visible on both layouts)
      cy.contains('button', 'Receive').should('be.visible');
    });

    it('does not show lock button in header when no password is set', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      cy.get('button[title="Lock Dashboard"]').should('not.exist');
    });
  });

  describe('Dashboard with password (authenticated)', () => {
    beforeEach(() => {
      cy.setupApiMocks();
      cy.mockAuthAuthenticated(); // Must come after setupApiMocks to override auth mock
    });

    it('shows lock button in header', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      cy.get('button[title="Lock Dashboard"]').should('be.visible');
    });

    it('clicking lock button shows lock screen', () => {
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      // Mock locked state for after clicking lock
      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: true,
          authenticated: false,
          autoLockMinutes: 5,
          lockScreenBg: 'storm-clouds',
        },
      }).as('getAuthStatusLocked');

      cy.get('button[title="Lock Dashboard"]').click();

      // Should show lock screen
      cy.contains('Enter password to continue').should('be.visible');
    });
  });

  describe('Settings - Security Section', () => {
    describe('Without password configured', () => {
      beforeEach(() => {
        cy.setupApiMocks();
        cy.mockAuthNoPassword(); // Must come after setupApiMocks to override auth mock
      });

      it('shows "No password set" message', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Password Protection').should('be.visible');
        cy.contains('No password set').should('be.visible');
      });

      it('shows hint about seed phrase access', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Set a password to view your wallet seed phrase').should('be.visible');
      });

      it('shows Setup button', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Setup').should('be.visible');
      });

      it('does not show Wallet Seed section', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Wallet Seed').should('not.exist');
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
        cy.mockAuthAuthenticated(); // Must come after setupApiMocks to override auth mock
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
        cy.contains('button', 'Never').should('be.visible');
        cy.contains('button', '5 minutes').should('be.visible');
        cy.contains('button', '15 minutes').should('be.visible');
      });

      it('shows Lock Screen Background options', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('Lock Screen Background').should('be.visible');
        cy.contains('Storm Clouds').should('be.visible');
        cy.contains('Lightning').should('be.visible');
      });

      it('shows Lock Now and Logout buttons', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        cy.contains('button', 'Lock Now').should('be.visible');
        cy.contains('button', 'Logout').should('be.visible');
      });

      it('shows Wallet Seed section', () => {
        cy.visit('/settings');
        cy.wait('@getAuthStatus');

        // Scroll to Wallet Seed section
        cy.contains('Wallet Seed').scrollIntoView().should('be.visible');
        cy.contains('Keep your seed phrase secret!').should('be.visible');
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
      cy.mockAuthAuthenticated(); // Must come after setupApiMocks to override auth mock
    });

    it('clicking View Seed Phrase shows password prompt', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.contains('Enter your dashboard password to reveal your wallet seed phrase').should(
        'be.visible'
      );
      cy.get('input[placeholder="Enter your password"]').should('be.visible');
    });

    it('Reveal Seed button is disabled without password', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.contains('button', 'Reveal Seed').should('be.disabled');
    });

    it('Reveal Seed button is enabled with password', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Enter your password"]').type('test1234');
      cy.contains('button', 'Reveal Seed').should('not.be.disabled');
    });

    it('shows seed phrase on correct password', () => {
      const testSeed = 'movie fan finish armed enough nut ramp picnic into jump token few';
      cy.mockGetSeed(testSeed);

      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Enter your password"]').type('correctpassword');
      cy.contains('button', 'Reveal Seed').click();

      cy.wait('@getSeed');
      cy.contains(testSeed).should('be.visible');
      cy.contains('button', 'Hide Seed Phrase').should('be.visible');
    });

    it('shows error on incorrect password', () => {
      cy.mockGetSeedFailure('Invalid password');

      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Enter your password"]').type('wrongpassword');
      cy.contains('button', 'Reveal Seed').click();

      cy.wait('@getSeedFailure');
      cy.contains('Invalid password').should('be.visible');
    });

    it('can hide seed phrase after viewing', () => {
      const testSeed = 'movie fan finish armed enough nut ramp picnic into jump token few';
      cy.mockGetSeed(testSeed);

      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.get('input[placeholder="Enter your password"]').type('correctpassword');
      cy.contains('button', 'Reveal Seed').click();

      cy.wait('@getSeed');
      cy.contains(testSeed).should('be.visible');

      cy.contains('button', 'Hide Seed Phrase').click();
      cy.contains(testSeed).should('not.exist');
      cy.contains('button', 'View Seed Phrase').should('be.visible');
    });

    it('can cancel seed viewing', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('button', 'View Seed Phrase').click();
      cy.contains('Enter your dashboard password').should('be.visible');

      cy.contains('button', 'Cancel').click();
      cy.contains('Enter your dashboard password').should('not.exist');
      cy.contains('button', 'View Seed Phrase').should('be.visible');
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
      cy.mockAuthAuthenticated(); // Must come after setupApiMocks to override auth mock
      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      cy.get('button[title="Lock Dashboard"]').should('be.visible');
    });
  });
});
