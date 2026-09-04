# Gatherboard

Gatherboard is a keyboard-accessible visual workspace for arranging sticky notes. It is a focused learning project inspired by collaborative whiteboards, built in releases so the spatial interaction model is proven before real-time collaboration is added.

**Status:** v1 complete. Live collaboration is planned for the next release.

## v0 features

- Create, edit, recolor, move, and delete sticky notes
- Pan and zoom the workspace
- Keyboard movement with `Alt` + arrow keys
- Undo and redo
- Automatic local persistence
- Reduced-motion support
- Unit, component, and Cypress end-to-end tests

## v1 features

- Named boards with shareable `/boards/:id` URLs
- Fastify create, read, and update API
- SQLite persistence through a repository boundary
- Shared Zod validation on both sides of the HTTP boundary
- Debounced autosave with visible loading and saving states
- Offline local fallback and retry behavior
- Protection against duplicate board creation during React Strict Mode

## Run locally

```bash
npm install
npm run dev
```

The development command starts both the web app and API. Open `http://127.0.0.1:4174`; the API listens on `http://127.0.0.1:4175`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Keyboard controls

- `Tab`: move between controls and notes
- `Alt` + arrow keys: move the focused note
- Arrow keys on the board background: pan the viewport
- `+` / `-`: zoom in or out
- `Ctrl`/`Command` + `Z`: undo
- `Ctrl`/`Command` + `Shift` + `Z`: redo
- `Escape`: cancel an active drag or pan

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the architecture and decision log. Use [LEARNING_SESSIONS.md](./LEARNING_SESSIONS.md) to reconstruct the important parts yourself.
