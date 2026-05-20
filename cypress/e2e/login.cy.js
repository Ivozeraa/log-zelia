describe("Login", () => {
  it("should authenticate with valid credentials", () => {
    const email = Cypress.env("USER_EMAIL") || "teste2026@gmail.com";
    const password = Cypress.env("USER_PASSWORD") || "12345678";

    cy.visit("/login");
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password, { log: false });
    cy.get('button[type="submit"]').click();

    cy.url().should("include", "/");
    cy.contains("Configurações").should("exist");
  });
});
