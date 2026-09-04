describe("Gatherboard v2", () => {
  it("commits live operations and restores the resulting board", () => {
    cy.clearLocalStorage();
    cy.visit("/");
    cy.url().should("match", /\/boards\/[a-f0-9-]+$/);
    cy.get(".save-status").should("contain.text", "Live");

    cy.findByLabelText("Board title").clear().type("Product planning").blur();

    cy.findByRole("button", { name: /^Add note$/ }).click();
    cy.get("[data-note-id]").last().as("newNote");
    cy.get("@newNote")
      .find("textarea")
      .type("Plan a collaborative session")
      .blur();
    cy.get("@newNote").find("select").select("green");
    cy.findByDisplayValue("Plan a collaborative session")
      .closest("[data-note-id]")
      .focus()
      .type("{alt}{rightarrow}");

    cy.get(".app-footer").should("contain.text", "Revision 5");

    cy.reload();
    cy.findByLabelText("Board title").should("have.value", "Product planning");
    cy.findByDisplayValue("Plan a collaborative session")
      .closest("[data-note-id]")
      .should("have.class", "sticky-note-green");
    cy.get(".save-status").should("contain.text", "Live");
  });
});
