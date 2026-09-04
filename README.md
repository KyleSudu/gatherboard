# Gatherboard

Gatherboard is a keyboard-accessible visual workspace for arranging sticky notes. It is a focused learning project inspired by collaborative whiteboards, built in releases so the spatial interaction model is proven before real-time collaboration is added.

**Status:** v0 complete. Server persistence and live collaboration are planned for later releases.

## v0 features

- Create, edit, recolor, move, and delete sticky notes
- Pan and zoom the workspace
- Keyboard movement with `Alt` + arrow keys
- Undo and redo
- Automatic local persistence
- Reduced-motion support
- Unit, component, and Cypress end-to-end tests

## Run locally

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:4174`.

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

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the architecture, roadmap, learning checkpoints, and decision log.
