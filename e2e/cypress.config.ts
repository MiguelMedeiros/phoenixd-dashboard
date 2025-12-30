import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    specPattern: 'e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'support/e2e.ts',
    fixturesFolder: 'fixtures',
    screenshotsFolder: 'screenshots',
    downloadsFolder: 'downloads',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
