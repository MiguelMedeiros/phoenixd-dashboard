describe('Settings Page', () => {
  beforeEach(() => {
    cy.setupApiMocks();
    cy.viewport(1280, 900);
  });

  describe('Page Load', () => {
    it('displays the settings page', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('Settings').should('be.visible');
    });

    it('displays all tabs', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('Security').should('be.visible');
      cy.contains('Network').should('be.visible');
      cy.contains('Display').should('be.visible');
      cy.contains('Wallet').should('be.visible');
      cy.contains('Notifications').should('be.visible');
    });

    it('defaults to Security tab', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      // Security tab should be active and show password protection section
      cy.contains('Password Protection').should('be.visible');
    });
  });

  describe('Display Tab', () => {
    beforeEach(() => {
      cy.visit('/settings?tab=display');
      cy.wait('@getAuthStatus');
    });

    it('displays currency selection', () => {
      cy.contains('Display Currency').should('be.visible');
      cy.contains('BTC').should('be.visible');
      cy.contains('USD').should('be.visible');
      cy.contains('EUR').should('be.visible');
    });

    it('displays theme options', () => {
      // Scroll to see theme options
      cy.contains('Dark').scrollIntoView();
      cy.contains('Dark').should('exist');
      cy.contains('Light').should('exist');
      cy.contains('Auto').should('exist');
    });

    it('displays animation settings section', () => {
      // Scroll to animations section
      cy.contains('Animations').scrollIntoView();
      cy.contains('Animations').should('exist');
    });
  });

  describe('Animation Settings', () => {
    beforeEach(() => {
      cy.visit('/settings?tab=display');
      cy.wait('@getAuthStatus');
      // Scroll to animations section
      cy.contains('Animations').scrollIntoView();
      cy.wait(500); // Wait for scroll to complete
    });

    it('displays all animation options', () => {
      cy.contains('Confetti').should('exist');
      cy.contains('Thunder').should('exist');
      cy.contains('Fireworks').should('exist');
      cy.contains('Electric Spark').should('exist');
      cy.contains('Coin Rain').should('exist');
      cy.contains('None').should('exist');
    });

    it('can select thunder animation', () => {
      // Click on Thunder animation option
      cy.contains('Thunder').click({ force: true });

      // Thunder button should have the selected class - check parent button
      cy.contains('Thunder').closest('button').should('have.class', 'bg-primary/10');
    });

    it('can select fireworks animation', () => {
      cy.contains('Fireworks').click({ force: true });

      cy.contains('Fireworks').closest('button').should('have.class', 'bg-primary/10');
    });

    it('displays preview button when animation is selected', () => {
      // Confetti should be default
      cy.contains('Preview Animation').should('exist');
    });

    it('hides preview button when None is selected', () => {
      cy.contains('None').click({ force: true });

      cy.contains('Preview Animation').should('not.exist');
    });

    it('can click preview button without errors', () => {
      // Click preview button - should not cause any errors
      cy.contains('Preview Animation').click({ force: true });

      // Page should still be functional
      cy.contains('Animations').should('exist');
    });

    it('displays sound toggle', () => {
      cy.contains('Animation Sounds').should('exist');
    });

    it('can toggle sound on/off', () => {
      // Scroll to sound toggle
      cy.contains('Animation Sounds').scrollIntoView();

      // Find and click the toggle button (the custom toggle element)
      cy.contains('Animation Sounds')
        .parents('.glass-card')
        .find('button[class*="inline-flex"]')
        .click({ force: true });

      // Check text changed to disabled
      cy.contains('Sound effects are disabled').should('exist');

      // Toggle back on
      cy.contains('Animation Sounds')
        .parents('.glass-card')
        .find('button[class*="inline-flex"]')
        .click({ force: true });

      cy.contains('Sound effects are enabled').should('exist');
    });

    it('persists animation selection across page navigation', () => {
      // Select thunder
      cy.contains('Thunder').click({ force: true });

      // Verify it's selected
      cy.contains('Thunder').closest('button').should('have.class', 'bg-primary/10');

      // Navigate away
      cy.visit('/');
      cy.wait(['@getNodeInfo', '@getBalance', '@getChannels']);

      // Navigate back to settings
      cy.visit('/settings?tab=display');
      cy.wait('@getAuthStatus');

      cy.contains('Animations').scrollIntoView();
      cy.wait(500);

      // Thunder should still be selected
      cy.contains('Thunder').closest('button').should('have.class', 'bg-primary/10');
    });

    it('allows switching between different animation types', () => {
      // Test cycling through animations
      const animations = ['Thunder', 'Fireworks', 'Electric Spark', 'Coin Rain', 'Confetti'];

      animations.forEach((anim) => {
        cy.contains(anim).click({ force: true });
        cy.contains(anim).closest('button').should('have.class', 'bg-primary/10');
      });
    });
  });

  describe('Security Tab', () => {
    it('displays password protection section', () => {
      cy.visit('/settings?tab=security');
      cy.wait('@getAuthStatus');

      cy.contains('Password Protection').should('be.visible');
    });

    it('shows setup button when no password is configured', () => {
      cy.mockAuthNoPassword();
      cy.visit('/settings?tab=security');
      cy.wait('@getAuthStatus');

      cy.contains('Setup').should('be.visible');
    });

    it('shows manage button when password is configured', () => {
      cy.mockAuthAuthenticated();
      cy.visit('/settings?tab=security');
      cy.wait('@getAuthStatus');

      cy.contains('Manage').should('be.visible');
    });
  });

  describe('Wallet Tab', () => {
    it('displays seed phrase warning', () => {
      cy.mockAuthAuthenticated();
      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('Keep your seed phrase secret').should('be.visible');
    });

    it('requires password to view seed', () => {
      cy.mockAuthAuthenticated();
      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('View Seed Phrase').click();
      cy.get('input[type="password"]').should('be.visible');
    });

    it('shows seed phrase after correct password', () => {
      cy.mockAuthAuthenticated();
      cy.mockGetSeed();
      cy.visit('/settings?tab=wallet');
      cy.wait('@getAuthStatus');

      cy.contains('View Seed Phrase').click();
      cy.get('input[type="password"]').type('correctpassword');
      cy.contains('Reveal Seed').click();
      cy.wait('@getSeed');

      cy.contains('abandon').should('be.visible');
    });
  });

  describe('Notifications Tab', () => {
    it('displays push notifications section', () => {
      cy.visit('/settings?tab=notifications');
      cy.wait('@getAuthStatus');

      cy.contains('Push Notifications').should('be.visible');
    });
  });

  describe('Tab Navigation', () => {
    it('updates URL when changing tabs', () => {
      cy.visit('/settings');
      cy.wait('@getAuthStatus');

      cy.contains('Display').click();
      cy.url().should('include', 'tab=display');

      cy.contains('Network').click();
      cy.url().should('include', 'tab=network');
    });

    it('loads correct tab from URL', () => {
      cy.visit('/settings?tab=notifications');
      cy.wait('@getAuthStatus');

      cy.contains('Push Notifications').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('displays correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/settings?tab=display');
      cy.wait('@getAuthStatus');

      cy.contains('Settings').should('be.visible');
      cy.contains('Display Currency').should('be.visible');
    });

    it('displays animation options in grid on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/settings?tab=display');
      cy.wait('@getAuthStatus');

      cy.contains('Animations').scrollIntoView();
      cy.contains('Confetti').should('exist');
      cy.contains('Thunder').should('exist');
    });
  });
});
