/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>;
      checkNoHorizontalOverflow(): Chainable<void>;
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

Cypress.Commands.add('checkNoHorizontalOverflow', () => {
  cy.window().then(win => {
    const docEl = win.document.documentElement;
    const scrollWidth = docEl.scrollWidth;
    const clientWidth = docEl.clientWidth;
    if (scrollWidth > clientWidth) {
      const overflowing: string[] = [];
      win.document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > win.innerWidth + 1) {
          overflowing.push(`${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')} (width: ${rect.width}px, right: ${rect.right}px)`);
        }
      });
      throw new Error(`Horizontal overflow detected! Page scrollWidth: ${scrollWidth}px vs clientWidth: ${clientWidth}px. Offending: ${overflowing.slice(0, 5).join(' | ')}`);
    }
  });
});

export {};

