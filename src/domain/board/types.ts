import type {
  BoardDocument,
  NoteColor,
  Point,
  StickyNote,
  Viewport,
} from "../../../shared";

export const noteColors = [
  "yellow",
  "pink",
  "blue",
  "green",
] as const satisfies readonly NoteColor[];

export type { BoardDocument, NoteColor, Point, StickyNote, Viewport };

export type PersistedBoard = {
  document: BoardDocument;
  viewport: Viewport;
  title?: string;
};
