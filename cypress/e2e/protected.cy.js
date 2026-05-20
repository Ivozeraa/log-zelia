describe("Protected routes", () => {
  it("should redirect unauthenticated users to login", () => {
    cy.visit("/advertencias");
    cy.url().should("include", "/login");
    cy.contains("Sistema de Ocorrências").should("exist");
  });
});
