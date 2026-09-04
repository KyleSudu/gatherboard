export const noteColors = ["yellow", "pink", "blue", "green"] as const;

export type NoteColor = (typeof noteColors)[number];

export type Point = {
  x: number;
  y: number;
};

export type StickyNote = {
  id: string;
  text: string;
  color: NoteColor;
  position: Point;
};

export type BoardDocument = {
  notes: StickyNote[];
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type PersistedBoard = {
  document: BoardDocument;
  viewport: Viewport;
};
