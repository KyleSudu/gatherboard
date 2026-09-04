describe("Gatherboard v0", () => {
  it("persists the core sticky-note journey", () => {
    cy.clearLocalStorage();
    cy.visit("/");

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

    cy.reload();
    cy.findByDisplayValue("Plan a collaborative session")
      .closest("[data-note-id]")
      .should("have.class", "sticky-note-green");
  });
});
