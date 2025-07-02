import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',
    video: false,
    screenshotOnRunFailure: false,
    supportFile: false, // Disable support file for now
  }
});