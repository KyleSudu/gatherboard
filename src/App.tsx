import { useEffect, useState } from "react";

import { BoardCanvas, PresenceBar, Toolbar } from "./components";
import {
  setViewport,
  type NoteColor,
  type Point,
  type StickyNote,
} from "./domain/board";
import { useBoardCollaboration, useBoardPersistence } from "./features/board";
import { useAppDispatch, useAppSelector } from "./state";

function makeNote(position: Point): StickyNote {
  return {
    id: crypto.randomUUID(),
    text: "",
    color: "yellow",
    position,
  };
}

type AppProps = {
  collaborationEnabled?: boolean;
  syncEnabled?: boolean;
};

export function App({
  collaborationEnabled = true,
  syncEnabled = true,
}: AppProps) {
  const dispatch = useAppDispatch();
  const { present, revision, title, viewport } = useAppSelector(
    (state) => state.board,
  );
  const [announcement, setAnnouncement] = useState("");
  const load = useBoardPersistence(syncEnabled);
  const collaboration = useBoardCollaboration({
    boardId: load.boardId,
    enabled: syncEnabled && collaborationEnabled,
    ready: load.ready,
  });

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      const commandKey = event.metaKey || event.ctrlKey;
      if (!commandKey || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        collaboration.redo();
        setAnnouncement("Change redone");
      } else {
        collaboration.undo();
        setAnnouncement("Change undone");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [collaboration]);

  function createNote(position?: Point) {
    const fallbackPosition = {
      x: Math.round(
        (120 - viewport.x) / viewport.zoom + present.notes.length * 18,
      ),
      y: Math.round(
        (110 - viewport.y) / viewport.zoom + present.notes.length * 18,
      ),
    };
    collaboration.createNote(makeNote(position ?? fallbackPosition));
    setAnnouncement("New note added");
  }

  function changeColor(id: string, color: NoteColor) {
    collaboration.changeColor(id, color);
    setAnnouncement(`Note color changed to ${color}`);
  }

  const connectionStatus = !load.ready ? load.status : collaboration.status;
  const statusLabel =
    connectionStatus === "loading"
      ? "Opening board"
      : connectionStatus === "connecting"
        ? "Connecting"
        : connectionStatus === "reconnecting"
          ? "Reconnecting"
          : connectionStatus === "offline"
            ? "Working offline"
            : connectionStatus === "error"
              ? "Sync interrupted"
              : connectionStatus === "disabled"
                ? "Local mode"
                : "Live";
  const errorMessage = load.errorMessage || collaboration.errorMessage;
  const unavailable =
    connectionStatus === "offline" || connectionStatus === "error";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <p className="eyebrow">A multiplayer canvas for shared thinking</p>
          <h1>Gatherboard</h1>
        </div>
        <label className="title-control">
          <span className="visually-hidden">Board title</span>
          <input
            key={title}
            defaultValue={title}
            disabled={!load.ready}
            maxLength={80}
            onBlur={(event) => {
              const nextTitle = event.target.value.trim() || "Untitled board";
              event.target.value = nextTitle;
              if (nextTitle !== title) collaboration.renameBoard(nextTitle);
            }}
          />
        </label>
        <div className="header-actions">
          <PresenceBar participants={collaboration.participants} />
          <button
            type="button"
            disabled={!load.boardId}
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              setAnnouncement("Board link copied");
            }}
          >
            Share link
          </button>
          <div
            className={`save-status save-status-${connectionStatus}`}
            role="status"
          >
            <span aria-hidden="true">●</span> {statusLabel}
          </div>
        </div>
      </header>

      {unavailable && (
        <aside className={`sync-message sync-message-${connectionStatus}`}>
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              load.retry();
              collaboration.retry();
            }}
          >
            Retry
          </button>
        </aside>
      )}

      <Toolbar
        canUndo={collaboration.canUndo}
        canRedo={collaboration.canRedo}
        disabled={!load.ready}
        zoom={viewport.zoom}
        onAddNote={() => createNote()}
        onUndo={() => {
          collaboration.undo();
          setAnnouncement("Change undone");
        }}
        onRedo={() => {
          collaboration.redo();
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
        participants={collaboration.participants}
        selfClientId={collaboration.clientId}
        onCursorMove={collaboration.sendCursor}
        onMoveNote={collaboration.moveNote}
        onAddAt={createNote}
        onAnnounce={setAnnouncement}
        onChangeColor={changeColor}
        onChangeText={(id, text) => {
          collaboration.changeText(id, text);
          setAnnouncement("Note text updated");
        }}
        onDelete={(note) => {
          collaboration.deleteNote(note.id);
          setAnnouncement(`Deleted ${note.text || "empty note"}`);
        }}
      />

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <footer className="app-footer">
        <span>{present.notes.length} notes</span>
        <span>Revision {revision}</span>
        <span>Live collaboration v2</span>
      </footer>
    </main>
  );
}
