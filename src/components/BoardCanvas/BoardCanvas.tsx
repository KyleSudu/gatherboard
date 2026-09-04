import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { StickyNoteCard } from "../StickyNoteCard";
import {
  moveNote,
  screenToBoardCoordinates,
  setViewport,
  zoomViewportAtPoint,
  type NoteColor,
  type Point,
  type StickyNote,
  type Viewport,
} from "../../domain/board";
import { useAppDispatch } from "../../state";

type DragState = {
  noteId: string;
  pointerId: number;
  startPointer: Point;
  startPosition: Point;
  currentPosition: Point;
};

type PanState = {
  pointerId: number;
  startPointer: Point;
  startViewport: Viewport;
};

type BoardCanvasProps = {
  notes: StickyNote[];
  viewport: Viewport;
  onAddAt: (position: Point) => void;
  onAnnounce: (message: string) => void;
  onChangeColor: (id: string, color: NoteColor) => void;
  onChangeText: (id: string, text: string) => void;
  onDelete: (note: StickyNote) => void;
};

export function BoardCanvas({
  notes,
  viewport,
  onAddAt,
  onAnnounce,
  onChangeColor,
  onChangeText,
  onDelete,
}: BoardCanvasProps) {
  const dispatch = useAppDispatch();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);

  function handleBoardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPan({
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startViewport: viewport,
    });
  }

  function handleBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pan || pan.pointerId !== event.pointerId) return;
    dispatch(
      setViewport({
        ...pan.startViewport,
        x: pan.startViewport.x + event.clientX - pan.startPointer.x,
        y: pan.startViewport.y + event.clientY - pan.startPointer.y,
      }),
    );
  }

  function finishPan(event: PointerEvent<HTMLDivElement>) {
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPan(null);
  }

  function startNoteDrag(
    note: StickyNote,
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      noteId: note.id,
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: note.position,
      currentPosition: note.position,
    });
  }

  function moveNoteDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag({
      ...drag,
      currentPosition: {
        x: Math.round(
          drag.startPosition.x +
            (event.clientX - drag.startPointer.x) / viewport.zoom,
        ),
        y: Math.round(
          drag.startPosition.y +
            (event.clientY - drag.startPointer.y) / viewport.zoom,
        ),
      },
    });
  }

  function finishNoteDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dispatch(moveNote({ id: drag.noteId, position: drag.currentPosition }));
    onAnnounce("Note moved");
    setDrag(null);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const change = event.deltaY > 0 ? -0.1 : 0.1;
    dispatch(
      setViewport(
        zoomViewportAtPoint(
          viewport,
          viewport.zoom + change,
          { x: event.clientX, y: event.clientY },
          rect,
        ),
      ),
    );
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    const panChanges: Partial<Record<string, Point>> = {
      ArrowLeft: { x: 60, y: 0 },
      ArrowRight: { x: -60, y: 0 },
      ArrowUp: { x: 0, y: 60 },
      ArrowDown: { x: 0, y: -60 },
    };
    const change = panChanges[event.key];
    if (change) {
      event.preventDefault();
      dispatch(
        setViewport({
          ...viewport,
          x: viewport.x + change.x,
          y: viewport.y + change.y,
        }),
      );
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      dispatch(
        setViewport({ ...viewport, zoom: Math.min(2, viewport.zoom + 0.1) }),
      );
    }
    if (event.key === "-") {
      event.preventDefault();
      dispatch(
        setViewport({ ...viewport, zoom: Math.max(0.5, viewport.zoom - 0.1) }),
      );
    }
    if (event.key === "Escape") {
      if (drag) setDrag(null);
      if (pan) {
        dispatch(setViewport(pan.startViewport));
        setPan(null);
      }
    }
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onAddAt(
      screenToBoardCoordinates(
        { x: event.clientX, y: event.clientY },
        rect,
        viewport,
      ),
    );
  }

  return (
    <div
      className={`board-canvas${pan ? " is-panning" : ""}`}
      role="region"
      aria-label="Gatherboard canvas. Use arrow keys to pan and plus or minus to zoom."
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleBoardKeyDown}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={finishPan}
      onPointerCancel={finishPan}
      onWheel={handleWheel}
    >
      <div
        className="board-world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
        aria-hidden="true"
      />

      <div
        className="note-layer"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {notes.map((note) => {
          const position =
            drag?.noteId === note.id ? drag.currentPosition : note.position;
          return (
            <StickyNoteCard
              key={note.id}
              note={note}
              position={position}
              onChangeColor={(color) => onChangeColor(note.id, color)}
              onChangeText={(text) => onChangeText(note.id, text)}
              onDelete={() => onDelete(note)}
              onDragStart={(event) => startNoteDrag(note, event)}
              onDragMove={moveNoteDrag}
              onDragEnd={finishNoteDrag}
              onKeyboardMove={(nextPosition) => {
                dispatch(moveNote({ id: note.id, position: nextPosition }));
                onAnnounce("Note moved");
              }}
            />
          );
        })}
      </div>

      <p className="canvas-hint" aria-hidden="true">
        Drag the background to pan · Scroll to zoom · Double-click to add
      </p>
    </div>
  );
}
