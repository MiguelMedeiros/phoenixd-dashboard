describe('Setup Wizard', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
  });

  describe('First run detection', () => {
    it('redirects to setup wizard when setup is not completed', () => {
      // Mock setup not completed
      cy.intercept('GET', '**/api/setup/status', {
        body: {
          setupCompleted: false,
          setupProfile: null,
          defaultLocale: 'en',
        },
      }).as('getSetupStatus');

      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: false,
          authenticated: true,
          autoLockMinutes: 0,
          lockScreenBg: 'storm-clouds',
          setupCompleted: false,
          defaultLocale: 'en',
        },
      }).as('getAuthStatus');

      cy.visit('/');
      cy.wait('@getAuthStatus');

      // Should redirect to setup page
      cy.url().should('include', '/setup');
    });

    it('shows dashboard when setup is completed', () => {
      cy.setupApiMocks();
      cy.mockAuthAuthenticated();

      // Override with setupCompleted: true
      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: true,
          authenticated: true,
          autoLockMinutes: 5,
          lockScreenBg: 'storm-clouds',
          setupCompleted: true,
          defaultLocale: 'en',
        },
      }).as('getAuthStatus');

      cy.visit('/');
      cy.wait(['@getAuthStatus', '@getNodeInfo', '@getBalance']);

      // Dashboard should be visible
      cy.get('.hero-card').should('be.visible');
    });
  });

  describe('Setup wizard steps', () => {
    beforeEach(() => {
      // Mock setup not completed
      cy.intercept('GET', '**/api/setup/status', {
        body: {
          setupCompleted: false,
          setupProfile: null,
          defaultLocale: 'en',
        },
      }).as('getSetupStatus');

      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: false,
          authenticated: true,
          autoLockMinutes: 0,
          lockScreenBg: 'storm-clouds',
          setupCompleted: false,
          defaultLocale: 'en',
        },
      }).as('getAuthStatus');

      cy.intercept('GET', '**/api/setup/available-apps', {
        body: [
          {
            slug: 'donations',
            name: 'Donations Page',
            description: 'Beautiful donation page to accept Lightning payments',
            icon: '💜',
            recommended: true,
          },
        ],
      }).as('getAvailableApps');
    });

    it('shows profile selection on first step', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Should show profile selection
      cy.contains('Choose Installation Profile').should('be.visible');
      cy.contains('Minimal').should('be.visible');
      cy.contains('Full').should('be.visible');
      cy.contains('Custom').should('be.visible');
    });

    it('can select minimal profile', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      cy.contains('Minimal').click();
      cy.contains('button', 'Next').click();

      // Should go to password step
      cy.contains('Create Your Password').should('be.visible');
    });

    it('can select custom profile and navigate through all steps', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Step 1: Profile selection
      cy.contains('Custom').click();
      cy.contains('button', 'Next').click();

      // Step 2: Password
      cy.contains('Create Your Password').should('be.visible');
      cy.get('input[id="password"]').type('testpass1234');
      cy.get('input[id="confirmPassword"]').type('testpass1234');
      cy.contains('button', 'Next').click();

      // Step 3: Language
      cy.contains('Select Your Language').should('be.visible');
      cy.contains('English').should('be.visible');
      cy.contains('button', 'Next').click();

      // Step 4: Theme
      cy.contains('Choose Your Theme').should('be.visible');
      cy.contains('Dark').should('be.visible');
      cy.contains('Light').should('be.visible');
      cy.contains('System').should('be.visible');
      cy.contains('button', 'Next').click();

      // Step 5: Phoenixd connection
      cy.contains('Configure Phoenixd Connection').should('be.visible');
      cy.contains('Local (Docker)').should('be.visible');
      cy.contains('External').should('be.visible');
      cy.contains('button', 'Next').click();

      // Step 6: Network services
      cy.contains('Network Services').should('be.visible');
      cy.contains('Tailscale').should('be.visible');
      cy.contains('Cloudflare Tunnel').should('be.visible');
      cy.contains('Tor Hidden Service').should('be.visible');
      cy.contains('button', 'Next').click();

      // Step 7: Apps
      cy.wait('@getAvailableApps');
      cy.contains('Pre-installed Apps').should('be.visible');
      cy.contains('Donations Page').should('be.visible');
      cy.contains('button', 'Next').click();

      // Step 8: Review
      cy.contains('Review Your Configuration').should('be.visible');
      cy.contains('Complete Setup').should('be.visible');
    });

    it('password validation works correctly', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      cy.contains('Custom').click();
      cy.contains('button', 'Next').click();

      // Empty password - next should be disabled
      cy.contains('button', 'Next').should('be.disabled');

      // Password too short
      cy.get('input[id="password"]').type('abc');
      cy.contains('button', 'Next').should('be.disabled');

      // Password long enough but no confirmation
      cy.get('input[id="password"]').clear().type('testpass');
      cy.contains('button', 'Next').should('be.disabled');

      // Passwords don't match
      cy.get('input[id="confirmPassword"]').type('wrongpass');
      cy.contains('Passwords do not match').should('be.visible');

      // Passwords match
      cy.get('input[id="confirmPassword"]').clear().type('testpass');
      cy.contains('button', 'Next').should('not.be.disabled');
    });

    it('can go back between steps', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      cy.contains('Custom').click();
      cy.contains('button', 'Next').click();

      // On password step
      cy.contains('Create Your Password').should('be.visible');

      // Go back
      cy.contains('button', 'Back').click();

      // Back on profile step
      cy.contains('Choose Installation Profile').should('be.visible');
    });

    it('shows progress indicator', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Should show step 1 of 8 for custom
      cy.contains('Custom').click();
      cy.contains('Step 1 of 8').should('be.visible');

      cy.contains('button', 'Next').click();
      cy.contains('Step 2 of 8').should('be.visible');
    });
  });

  describe('Setup completion', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/setup/status', {
        body: {
          setupCompleted: false,
          setupProfile: null,
          defaultLocale: 'en',
        },
      }).as('getSetupStatus');

      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: false,
          authenticated: true,
          autoLockMinutes: 0,
          lockScreenBg: 'storm-clouds',
          setupCompleted: false,
          defaultLocale: 'en',
        },
      }).as('getAuthStatus');

      cy.intercept('GET', '**/api/setup/available-apps', {
        body: [
          {
            slug: 'donations',
            name: 'Donations Page',
            description: 'Beautiful donation page to accept Lightning payments',
            icon: '💜',
            recommended: true,
          },
        ],
      }).as('getAvailableApps');
    });

    it('completes setup with minimal profile', () => {
      cy.intercept('POST', '**/api/setup/complete', {
        body: {
          success: true,
          message: 'Setup completed successfully',
          locale: 'en',
        },
      }).as('completeSetup');

      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Select minimal profile
      cy.contains('Minimal').click();
      cy.contains('button', 'Next').click();

      // Enter password
      cy.get('input[id="password"]').type('testpass1234');
      cy.get('input[id="confirmPassword"]').type('testpass1234');
      cy.contains('button', 'Next').click();

      // On review step
      cy.contains('Review Your Configuration').should('be.visible');

      // Complete setup
      cy.contains('button', 'Complete Setup').click();
      cy.wait('@completeSetup');
    });
  });

  describe('External phoenixd connection', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/setup/status', {
        body: {
          setupCompleted: false,
          setupProfile: null,
          defaultLocale: 'en',
        },
      }).as('getSetupStatus');

      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: false,
          authenticated: true,
          autoLockMinutes: 0,
          lockScreenBg: 'storm-clouds',
          setupCompleted: false,
          defaultLocale: 'en',
        },
      }).as('getAuthStatus');

      cy.intercept('GET', '**/api/setup/available-apps', {
        body: [],
      }).as('getAvailableApps');
    });

    it('shows external connection form when selected', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Go to phoenixd step
      cy.contains('Custom').click();
      cy.contains('button', 'Next').click(); // password

      cy.get('input[id="password"]').type('testpass1234');
      cy.get('input[id="confirmPassword"]').type('testpass1234');
      cy.contains('button', 'Next').click(); // language

      cy.contains('button', 'Next').click(); // theme
      cy.contains('button', 'Next').click(); // phoenixd step

      // Select external
      cy.contains('External').click();

      // Should show connection form
      cy.contains('Connection Name').should('be.visible');
      cy.contains('Phoenixd URL').should('be.visible');
      cy.contains('API Password').should('be.visible');
    });

    it('can test external connection', () => {
      cy.intercept('POST', '**/api/setup/test-phoenixd', {
        body: {
          success: true,
          nodeId: 'test-node-id-12345',
          chain: 'mainnet',
          version: '0.4.0',
        },
      }).as('testPhoenixd');

      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Go to phoenixd step
      cy.contains('Custom').click();
      cy.contains('button', 'Next').click();

      cy.get('input[id="password"]').type('testpass1234');
      cy.get('input[id="confirmPassword"]').type('testpass1234');
      cy.contains('button', 'Next').click();

      cy.contains('button', 'Next').click();
      cy.contains('button', 'Next').click();

      // Select external
      cy.contains('External').click();

      // Fill in connection details
      cy.get('input[id="url-0"]').type('http://192.168.1.100:9740');
      cy.get('input[id="password-0"]').type('mypassword');

      // Test connection
      cy.contains('button', 'Test Connection').click();
      cy.wait('@testPhoenixd');

      // Should show success
      cy.contains('mainnet').should('be.visible');
    });
  });

  describe('Mobile responsiveness', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');

      cy.intercept('GET', '**/api/setup/status', {
        body: {
          setupCompleted: false,
          setupProfile: null,
          defaultLocale: 'en',
        },
      }).as('getSetupStatus');

      cy.intercept('GET', '**/api/auth/status', {
        body: {
          hasPassword: false,
          authenticated: true,
          autoLockMinutes: 0,
          lockScreenBg: 'storm-clouds',
          setupCompleted: false,
          defaultLocale: 'en',
        },
      }).as('getAuthStatus');
    });

    it('wizard works on mobile viewport', () => {
      cy.visit('/en/setup');
      cy.wait('@getSetupStatus');

      // Profile cards should be visible
      cy.contains('Minimal').should('be.visible');
      cy.contains('Full').should('be.visible');
      cy.contains('Custom').should('be.visible');

      // Navigation should work
      cy.contains('Custom').click();
      cy.contains('button', 'Next').click();

      cy.contains('Create Your Password').should('be.visible');
    });
  });
});
