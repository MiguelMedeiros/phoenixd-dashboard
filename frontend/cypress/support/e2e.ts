// ***********************************************************
// This file is processed and loaded automatically before your test files.
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';

// Prevent uncaught exceptions from failing tests
Cypress.on('uncaught:exception', (err) => {
  // Ignore ResizeObserver errors (common in React apps)
  if (err.message.includes('ResizeObserver')) {
    return false;
  }
  // Ignore hydration errors in development
  if (err.message.includes('Hydration')) {
    return false;
  }
  return true;
});

// Add custom log for better debugging
Cypress.Commands.overwrite('log', (originalFn, message, ...args) => {
  console.log(`[Cypress] ${message}`, ...args);
  return originalFn(message, ...args);
});
