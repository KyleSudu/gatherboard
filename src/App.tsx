import { useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "./state";
import { BoardCanvas, Toolbar } from "./components";
import {
  addNote,
  changeNoteColor,
  deleteNote,
  redo,
  setViewport,
  undo,
  updateNoteText,
  type NoteColor,
  type Point,
  type StickyNote,
} from "./domain/board";
import { useBoardPersistence } from "./features/board";

function makeNote(position: Point): StickyNote {
  return {
    id: crypto.randomUUID(),
    text: "",
    color: "yellow",
    position,
  };
}

type AppProps = {
  syncEnabled?: boolean;
};

export function App({ syncEnabled = true }: AppProps) {
  const dispatch = useAppDispatch();
  const { present, past, future, viewport } = useAppSelector(
    (state) => state.board,
  );
  const [announcement, setAnnouncement] = useState("");
  const { boardId, errorMessage, renameBoard, retry, status, title } =
    useBoardPersistence(syncEnabled);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      const commandKey = event.metaKey || event.ctrlKey;
      if (!commandKey || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        dispatch(redo());
        setAnnouncement("Change redone");
      } else {
        dispatch(undo());
        setAnnouncement("Change undone");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [dispatch]);

  function createNote(position?: Point) {
    const fallbackPosition = {
      x: Math.round(
        (120 - viewport.x) / viewport.zoom + present.notes.length * 18,
      ),
      y: Math.round(
        (110 - viewport.y) / viewport.zoom + present.notes.length * 18,
      ),
    };
    dispatch(addNote(makeNote(position ?? fallbackPosition)));
    setAnnouncement("New note added");
  }

  function changeColor(id: string, color: NoteColor) {
    dispatch(changeNoteColor({ id, color }));
    setAnnouncement(`Note color changed to ${color}`);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <p className="eyebrow">A collaborative canvas, starting locally</p>
          <h1>Gatherboard</h1>
        </div>
        <label className="title-control">
          <span className="visually-hidden">Board title</span>
          <input
            value={title}
            maxLength={80}
            onChange={(event) => renameBoard(event.target.value)}
            onBlur={() => {
              if (!title.trim()) renameBoard("Untitled board");
            }}
          />
        </label>
        <div className="header-actions">
          <button
            type="button"
            disabled={!boardId}
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              setAnnouncement("Board link copied");
            }}
          >
            Share link
          </button>
          <div className={`save-status save-status-${status}`} role="status">
            <span aria-hidden="true">●</span>{" "}
            {status === "loading"
              ? "Opening board"
              : status === "saving"
                ? "Saving"
                : status === "offline"
                  ? "Saved locally"
                  : status === "error"
                    ? "Save failed"
                    : "Saved"}
          </div>
        </div>
      </header>

      {(status === "offline" || status === "error") && (
        <aside className={`sync-message sync-message-${status}`}>
          <span>{errorMessage}</span>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </aside>
      )}

      <Toolbar
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        zoom={viewport.zoom}
        onAddNote={() => createNote()}
        onUndo={() => {
          dispatch(undo());
          setAnnouncement("Change undone");
        }}
        onRedo={() => {
          dispatch(redo());
          setAnnouncement("Change redone");
        }}
        onPan={(x, y) =>
          dispatch(
            setViewport({ ...viewport, x: viewport.x + x, y: viewport.y + y }),
          )
        }
        onZoom={(change) =>
          dispatch(
            setViewport({
              ...viewport,
              zoom: Math.max(0.5, Math.min(2, viewport.zoom + change)),
            }),
          )
        }
        onResetView={() => dispatch(setViewport({ x: 0, y: 0, zoom: 1 }))}
      />

      <BoardCanvas
        notes={present.notes}
        viewport={viewport}
        onAddAt={createNote}
        onAnnounce={setAnnouncement}
        onChangeColor={changeColor}
        onChangeText={(id, text) => {
          dispatch(updateNoteText({ id, text }));
          setAnnouncement("Note text updated");
        }}
        onDelete={(note) => {
          dispatch(deleteNote(note.id));
          setAnnouncement(`Deleted ${note.text || "empty note"}`);
        }}
      />

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <footer className="app-footer">
        <span>{present.notes.length} notes</span>
        <span>Persistent boards v1</span>
      </footer>
    </main>
  );
}
