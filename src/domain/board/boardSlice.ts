import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { applyBoardOperation, type BoardOperation } from "../../../shared";
import type {
  BoardDocument,
  NoteColor,
  PersistedBoard,
  Point,
  StickyNote,
  Viewport,
} from "./types";

const starterDocument: BoardDocument = {
  notes: [
    {
      id: "welcome",
      text: "Double-click the board or use Add note",
      color: "yellow",
      position: { x: 96, y: 96 },
    },
    {
      id: "keyboard",
      text: "Focus a note and press Alt + arrow keys",
      color: "blue",
      position: { x: 360, y: 190 },
    },
  ],
};

export type BoardState = {
  present: BoardDocument;
  past: BoardDocument[];
  future: BoardDocument[];
  viewport: Viewport;
  title: string;
  revision: number;
};

export const initialBoardState: BoardState = {
  present: starterDocument,
  past: [],
  future: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  title: "Untitled board",
  revision: 0,
};

function copyDocument(document: BoardDocument): BoardDocument {
  return {
    notes: document.notes.map((note) => ({
      ...note,
      position: { ...note.position },
    })),
  };
}

function rememberPresent(state: BoardState) {
  state.past.push(copyDocument(state.present));
  if (state.past.length > 50) state.past.shift();
  state.future = [];
}

const boardSlice = createSlice({
  name: "board",
  initialState: initialBoardState,
  reducers: {
    hydrateBoard(_state, action: PayloadAction<PersistedBoard>) {
      return {
        present: copyDocument(action.payload.document),
        viewport: { ...action.payload.viewport },
        past: [],
        future: [],
        title: action.payload.title ?? "Untitled board",
        revision: action.payload.revision ?? 0,
      };
    },
    applyCollaborationOperation(state, action: PayloadAction<BoardOperation>) {
      const applied = applyBoardOperation(
        { title: state.title, document: state.present },
        action.payload,
      );
      state.title = applied.title;
      state.present = applied.document;
    },
    setRevision(state, action: PayloadAction<number>) {
      state.revision = action.payload;
    },
    addNote(state, action: PayloadAction<StickyNote>) {
      rememberPresent(state);
      state.present.notes.push(action.payload);
    },
    updateNoteText(state, action: PayloadAction<{ id: string; text: string }>) {
      const note = state.present.notes.find(
        ({ id }) => id === action.payload.id,
      );
      if (!note || note.text === action.payload.text) return;
      rememberPresent(state);
      const currentNote = state.present.notes.find(
        ({ id }) => id === action.payload.id,
      );
      if (currentNote) currentNote.text = action.payload.text;
    },
    moveNote(state, action: PayloadAction<{ id: string; position: Point }>) {
      const note = state.present.notes.find(
        ({ id }) => id === action.payload.id,
      );
      if (
        !note ||
        (note.position.x === action.payload.position.x &&
          note.position.y === action.payload.position.y)
      ) {
        return;
      }
      rememberPresent(state);
      const currentNote = state.present.notes.find(
        ({ id }) => id === action.payload.id,
      );
      if (currentNote) currentNote.position = action.payload.position;
    },
    changeNoteColor(
      state,
      action: PayloadAction<{ id: string; color: NoteColor }>,
    ) {
      const note = state.present.notes.find(
        ({ id }) => id === action.payload.id,
      );
      if (!note || note.color === action.payload.color) return;
      rememberPresent(state);
      const currentNote = state.present.notes.find(
        ({ id }) => id === action.payload.id,
      );
      if (currentNote) currentNote.color = action.payload.color;
    },
    deleteNote(state, action: PayloadAction<string>) {
      if (!state.present.notes.some(({ id }) => id === action.payload)) return;
      rememberPresent(state);
      state.present.notes = state.present.notes.filter(
        ({ id }) => id !== action.payload,
      );
    },
    setViewport(state, action: PayloadAction<Viewport>) {
      state.viewport = action.payload;
    },
    undo(state) {
      const previous = state.past.pop();
      if (!previous) return;
      state.future.unshift(copyDocument(state.present));
      state.present = previous;
    },
    redo(state) {
      const next = state.future.shift();
      if (!next) return;
      state.past.push(copyDocument(state.present));
      state.present = next;
    },
  },
});

export const {
  applyCollaborationOperation,
  addNote,
  changeNoteColor,
  deleteNote,
  hydrateBoard,
  moveNote,
  redo,
  setViewport,
  setRevision,
  undo,
  updateNoteText,
} = boardSlice.actions;

export const boardReducer = boardSlice.reducer;
