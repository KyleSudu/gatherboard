describe("Gatherboard v1", () => {
  it("persists the core sticky-note journey", () => {
    cy.clearLocalStorage();
    cy.intercept("PUT", "/api/boards/*").as("saveBoard");
    cy.visit("/");
    cy.url().should("match", /\/boards\/[a-f0-9-]+$/);

    cy.findByLabelText("Board title").clear().type("Product planning").blur();

    cy.findByRole("button", { name: /^Add note$/ }).click();
    cy.get("[data-note-id]").last().as("newNote");
    cy.get("@newNote")
      .find("textarea")
      .type("Plan a collaborative session")
      .blur();
    cy.get("@newNote").find("select").select("green");
    cy.get("@newNote")
      .focus()
      .trigger("keydown", { key: "ArrowRight", altKey: true });

    cy.wait("@saveBoard").its("response.statusCode").should("equal", 200);
    cy.get(".save-status").should("contain.text", "Saved");

    cy.reload();
    cy.findByLabelText("Board title").should("have.value", "Product planning");
    cy.findByDisplayValue("Plan a collaborative session")
      .closest("[data-note-id]")
      .should("have.class", "sticky-note-green");
  });
});
