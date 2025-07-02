describe('PROFYLE App E2E', () => {
    it('should load the homepage', () => {
      cy.visit('/');
      cy.contains('PROFYLE');
    });
  });