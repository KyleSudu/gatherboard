import { describe, expect, it } from "vitest";

import { applyBoardOperation } from "./applyBoardOperation";
import type { BoardOperation } from "./collaborationContracts";

const identity = {
  operationId: "c75c6c52-35cc-44c6-918c-80aa78ac11d7",
  boardId: "1b2dcdf3-7c07-4dc2-8818-318e46cb42cd",
  clientId: "66aae455-8ca4-4e05-9e3c-7eb8221f573f",
  clientSequence: 0,
};

const target = {
  title: "Workshop",
  document: {
    notes: [
      {
        id: "first",
        text: "Start small",
        color: "yellow" as const,
        position: { x: 20, y: 30 },
      },
    ],
  },
};

describe("applyBoardOperation", () => {
  it("applies note and title operations without mutating the input", () => {
    const moved = applyBoardOperation(target, {
      ...identity,
      type: "note.moved",
      payload: { noteId: "first", position: { x: 80, y: 90 } },
    });
    const renamed = applyBoardOperation(moved, {
      ...identity,
      operationId: "766625db-4ad7-4736-a379-75814459de65",
      type: "board.titleChanged",
      payload: { title: "Retrospective" },
    });

    expect(target.document.notes[0].position).toEqual({ x: 20, y: 30 });
    expect(renamed.document.notes[0].position).toEqual({ x: 80, y: 90 });
    expect(renamed.title).toBe("Retrospective");
  });

  it("makes creating the same note idempotent", () => {
    const operation: BoardOperation = {
      ...identity,
      type: "note.created",
      payload: { note: target.document.notes[0] },
    };

    expect(applyBoardOperation(target, operation)).toBe(target);
  });
});
