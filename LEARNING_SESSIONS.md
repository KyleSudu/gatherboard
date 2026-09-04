# Gatherboard reconstruction sessions

This guide is for rebuilding the important parts of Gatherboard after first seeing the finished product. Do not try to memorize the implementation. Start from the behavior and tests, write your own version, and then compare decisions.

Each session should end with a short teach-back answering:

1. What data entered this layer?
2. What transformation or decision happened here?
3. What invariant does the code protect?
4. What failure would appear if the layer disappeared?

## Session 1: Trace one note through the system

**Goal:** Build a mental map before rewriting anything.

Start in `StickyNoteCard`, follow an edited note into `App`, then through `boardSlice`, local persistence, `useBoardPersistence`, the API client, Fastify, `BoardRepository`, and SQLite.

Draw this path without looking at the architecture diagram:

```text
textarea blur → Redux action → reducer → localStorage → debounce
→ PUT /api/boards/:id → Zod → repository → SQLite
```

**Check:** Explain why the textarea commits on blur instead of creating one undo entry per character.

## Session 2: Rebuild coordinate conversion

**Goal:** Understand the boundary between screen pixels and board coordinates.

Open only `coordinates.test.ts`. Reimplement `screenToBoardCoordinates` until the tests pass. Then implement zoom-around-pointer behavior.

The central relationship is:

```text
boardX = (screenX - elementLeft - panX) / zoom
```

**Check:** At 200% zoom, explain why a 40-pixel pointer movement moves a note only 20 board units.

## Session 3: Rebuild document history

**Goal:** Understand state snapshots and undo/redo.

Starting from `boardSlice.test.ts`, create a reducer with `past`, `present`, and `future`. Add one operation at a time. Do not include viewport changes in history.

**Check:** Explain why undoing after a new edit must clear the redo stack.

## Session 4: Rebuild the drag lifecycle

**Goal:** Separate a high-frequency preview from a durable domain change.

Implement pointer down, move, and up for one note. Keep the moving position in component state and dispatch exactly one `moveNote` action on pointer up.

**Check:** Explain what would happen to rendering, persistence, and undo history if every pointer-move event dispatched a durable action.

## Session 5: Design the runtime contract

**Goal:** Learn why TypeScript alone does not make an API safe.

Write the `StickyNote`, `BoardDocument`, `Viewport`, `SaveBoardInput`, and `BoardRecord` types on paper. Then build Zod schemas that enforce them at runtime and infer the TypeScript types from those schemas.

Try these invalid inputs:

- A zoom level of `99`
- A note with an unknown color
- An empty title
- A note position containing `NaN`

**Check:** Explain why JSON from a network request is still `unknown` even when both repositories use TypeScript.

## Session 6: Rebuild the Fastify boundary

**Goal:** Separate HTTP concerns from business and storage concerns.

Implement these routes against an in-memory repository:

```text
POST /api/boards
GET  /api/boards/:id
PUT  /api/boards/:id
```

Validate before calling the repository. Return `400` for invalid input and `404` for a missing valid ID.

**Check:** Describe the distinct responsibilities of the route handler and repository.

## Session 7: Rebuild SQLite persistence

**Goal:** Learn a narrow data-access boundary.

Create a `boards` table and implement `create`, `findById`, and `update`. Use an in-memory SQLite database in tests and a file-backed database in development.

The current version stores the document and viewport as JSON. Before copying that choice, list its tradeoffs against normalized note rows.

**Check:** Explain why JSON snapshots are reasonable for v1 but poorly suited to concurrent note-level updates in v2.

## Session 8: Rebuild client synchronization

**Goal:** Coordinate server state without mixing it into the interaction reducer.

Build a hook that:

1. Reads an optional board ID from the URL.
2. Creates or loads a board.
3. Hydrates Redux.
4. Watches document, viewport, and title changes.
5. Saves locally immediately.
6. Debounces remote saves.

**Check:** Explain what `lastSynced` prevents and why an in-flight initial request is reused under React Strict Mode.

## Session 9: Rebuild failure states

**Goal:** Treat failure as part of the product rather than an exception to it.

Test four states independently:

- Loading a board
- Saving changes
- Losing the server while local storage remains available
- Opening a valid-looking URL for a missing board

**Check:** Explain the difference between “offline” and “error” in this product and what action the user can safely take in each state.

## Session 10: Rebuild the happy-path test

**Goal:** Verify behavior across every system boundary.

Write a Cypress test that begins at `/`, waits for a generated board URL, renames the board, creates and edits a note, reloads the same URL, and verifies that SQLite restored the changes.

**Check:** Identify which behaviors are already covered by faster unit tests and which confidence only the browser test provides.

## Before starting multiplayer v2

You are ready when you can explain these without opening the code:

- Why view state and document state are separate
- Why a drag produces one durable action
- Why TypeScript does not validate network traffic
- Why the client saves locally before the server responds
- Why v1 stores snapshots but v2 should exchange operations
- What React Strict Mode revealed about request side effects

The first v2 exercise should be designing an operation such as:

```ts
type BoardOperation = {
  operationId: string;
  boardId: string;
  clientId: string;
  sequence: number;
  type: "note.moved";
  payload: {
    noteId: string;
    position: { x: number; y: number };
  };
};
```

Do not add WebSockets until you can describe how duplicate, delayed, and out-of-order operations should behave.
