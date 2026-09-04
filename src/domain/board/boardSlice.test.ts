import { describe, expect, it } from "vitest";

import {
  addNote,
  boardReducer,
  changeNoteColor,
  deleteNote,
  moveNote,
  redo,
  undo,
  updateNoteText,
} from "./boardSlice";
import type { StickyNote } from "./types";

const note: StickyNote = {
  id: "new-note",
  text: "Ship the smallest thing",
  color: "yellow",
  position: { x: 10, y: 20 },
};

describe("board reducer", () => {
  it("applies every note operation", () => {
    let state = boardReducer(undefined, addNote(note));
    state = boardReducer(
      state,
      updateNoteText({ id: note.id, text: "Test the smallest thing" }),
    );
    state = boardReducer(
      state,
      moveNote({ id: note.id, position: { x: 80, y: 120 } }),
    );
    state = boardReducer(
      state,
      changeNoteColor({ id: note.id, color: "pink" }),
    );

    expect(state.present.notes.at(-1)).toMatchObject({
      text: "Test the smallest thing",
      color: "pink",
      position: { x: 80, y: 120 },
    });

    state = boardReducer(state, deleteNote(note.id));
    expect(state.present.notes).not.toContainEqual(
      expect.objectContaining({ id: note.id }),
    );
  });

  it("undoes and redoes one committed operation", () => {
    const added = boardReducer(undefined, addNote(note));
    const undone = boardReducer(added, undo());
    const redone = boardReducer(undone, redo());

    expect(undone.present.notes).not.toContainEqual(
      expect.objectContaining({ id: note.id }),
    );
    expect(redone.present.notes).toContainEqual(note);
  });

  it("does not create history for an unchanged update", () => {
    const added = boardReducer(undefined, addNote(note));
    const unchanged = boardReducer(
      added,
      moveNote({ id: note.id, position: note.position }),
    );

    expect(unchanged.past).toHaveLength(1);
  });
});
