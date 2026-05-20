Cypress.Commands.add("login", (email, password) => {
  return cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password, { log: false });
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/login');
    cy.contains('Configurações', { timeout: 10000 }).should('exist');
  }, {
    validate() {
      cy.visit('/');
      cy.contains('Configurações', { timeout: 5000 }).should('exist');
    }
  });
});

Cypress.Commands.add("selectFirstDropdownOption", (labelText) => {
  cy.contains('label', labelText)
    .parent()
    .find('button')
    .first()
    .click();

  cy.get('div.absolute.left-0.right-0.top-full:visible')
    .find('button')
    .first()
    .click();
});

Cypress.Commands.add("selectDropdownOption", (labelText, optionText) => {
  cy.contains('label', labelText)
    .parent()
    .find('button')
    .first()
    .click();

  cy.get('div.absolute.left-0.right-0.top-full:visible')
    .contains('button', optionText)
    .click();
});
