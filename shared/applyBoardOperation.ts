import type { BoardDocument } from "./boardContracts";
import type { BoardOperation } from "./collaborationContracts";

export type OperationTarget = {
  title: string;
  document: BoardDocument;
};

/** Applies one idempotent collaboration operation without depending on Redux, HTTP, or SQLite. */
export function applyBoardOperation(
  target: OperationTarget,
  operation: BoardOperation,
): OperationTarget {
  const notes = target.document.notes;

  switch (operation.type) {
    case "note.created":
      if (notes.some(({ id }) => id === operation.payload.note.id))
        return target;
      return {
        ...target,
        document: { notes: [...notes, operation.payload.note] },
      };
    case "note.moved":
      return updateNote(
        target,
        operation.payload.noteId,
        (note) => ({
          ...note,
          position: operation.payload.position,
        }),
        (note) =>
          note.position.x === operation.payload.position.x &&
          note.position.y === operation.payload.position.y,
      );
    case "note.textChanged":
      return updateNote(
        target,
        operation.payload.noteId,
        (note) => ({
          ...note,
          text: operation.payload.text,
        }),
        (note) => note.text === operation.payload.text,
      );
    case "note.colorChanged":
      return updateNote(
        target,
        operation.payload.noteId,
        (note) => ({
          ...note,
          color: operation.payload.color,
        }),
        (note) => note.color === operation.payload.color,
      );
    case "note.deleted":
      if (!notes.some(({ id }) => id === operation.payload.noteId)) {
        return target;
      }
      return {
        ...target,
        document: {
          notes: notes.filter(({ id }) => id !== operation.payload.noteId),
        },
      };
    case "board.titleChanged":
      if (target.title === operation.payload.title) return target;
      return { ...target, title: operation.payload.title };
  }
}

function updateNote(
  target: OperationTarget,
  noteId: string,
  update: (
    note: BoardDocument["notes"][number],
  ) => BoardDocument["notes"][number],
  unchanged: (note: BoardDocument["notes"][number]) => boolean = () => false,
) {
  const current = target.document.notes.find(({ id }) => id === noteId);
  if (!current || unchanged(current)) return target;
  return {
    ...target,
    document: {
      notes: target.document.notes.map((note) =>
        note.id === noteId ? update(note) : note,
      ),
    },
  };
}
