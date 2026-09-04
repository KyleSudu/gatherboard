import type { KeyboardEvent, PointerEvent } from "react";

import {
  noteColors,
  type NoteColor,
  type Point,
  type StickyNote,
} from "../../domain/board";

type StickyNoteCardProps = {
  note: StickyNote;
  position: Point;
  onChangeColor: (color: NoteColor) => void;
  onChangeText: (text: string) => void;
  onDelete: () => void;
  onDragMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyboardMove: (position: Point) => void;
};

export function StickyNoteCard({
  note,
  position,
  onChangeColor,
  onChangeText,
  onDelete,
  onDragMove,
  onDragStart,
  onDragEnd,
  onKeyboardMove,
}: StickyNoteCardProps) {
  function handleKeyboardMove(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || !event.altKey) return;

    const moves: Partial<Record<string, Point>> = {
      ArrowLeft: { x: -10, y: 0 },
      ArrowRight: { x: 10, y: 0 },
      ArrowUp: { x: 0, y: -10 },
      ArrowDown: { x: 0, y: 10 },
    };
    const change = moves[event.key];
    if (!change) return;

    event.preventDefault();
    onKeyboardMove({
      x: position.x + change.x,
      y: position.y + change.y,
    });
  }

  return (
    <article
      className={`sticky-note sticky-note-${note.color}`}
      data-note-id={note.id}
      data-testid={`note-${note.id}`}
      style={{ left: position.x, top: position.y }}
      tabIndex={0}
      aria-label={`Sticky note: ${note.text || "Empty note"}`}
      onKeyDown={handleKeyboardMove}
    >
      <div className="note-header">
        <button
          className="drag-handle"
          type="button"
          aria-label={`Drag ${note.text || "empty note"}`}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <span className="note-type">Sticky note</span>
        <button
          className="icon-button"
          type="button"
          aria-label={`Delete ${note.text || "empty note"}`}
          onClick={onDelete}
        >
          ×
        </button>
      </div>

      <label className="visually-hidden" htmlFor={`note-text-${note.id}`}>
        Note text
      </label>
      <textarea
        key={`${note.id}:${note.text}`}
        id={`note-text-${note.id}`}
        defaultValue={note.text}
        placeholder="Write an idea…"
        onBlur={(event) => onChangeText(event.target.value)}
      />

      <label className="color-control">
        <span>Color</span>
        <select
          aria-label={`Color for ${note.text || "empty note"}`}
          value={note.color}
          onChange={(event) => onChangeColor(event.target.value as NoteColor)}
        >
          {noteColors.map((color) => (
            <option key={color} value={color}>
              {color[0].toUpperCase() + color.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}
