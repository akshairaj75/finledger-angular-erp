/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email = 'admin@finledger.com', password = 'password') => {
  cy.visit('/login');
  cy.get('input[type="email"], input[name="email"], input[formcontrolname="email"]').type(email);
  cy.get('input[type="password"], input[name="password"], input[formcontrolname="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

export {};

