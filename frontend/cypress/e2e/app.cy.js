describe('PROFYLE App E2E', () => {
    beforeEach(() => {
      cy.visit('/');
    });
  
    it('should load the homepage', () => {
      cy.contains('PROFYLE');
      cy.url().should('include', '/');
    });
  
    it('should navigate to login page', () => {
      cy.get('[data-testid="login-button"]').click();
      cy.url().should('include', '/login');
    });
  
    it('should complete user registration flow', () => {
      cy.get('[data-testid="register-button"]').click();
      
      cy.get('input[name="name"]').type('Test User');
      cy.get('input[name="email"]').type('test@example.com');
      cy.get('input[name="password"]').type('password123');
      
      cy.get('button[type="submit"]').click();
      
      cy.url().should('include', '/dashboard');
      cy.contains('Welcome, Test User');
    });
  });