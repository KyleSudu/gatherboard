type ToolbarProps = {
  canRedo: boolean;
  canUndo: boolean;
  zoom: number;
  onAddNote: () => void;
  onPan: (x: number, y: number) => void;
  onRedo: () => void;
  onResetView: () => void;
  onUndo: () => void;
  onZoom: (change: number) => void;
};

export function Toolbar({
  canRedo,
  canUndo,
  zoom,
  onAddNote,
  onPan,
  onRedo,
  onResetView,
  onUndo,
  onZoom,
}: ToolbarProps) {
  return (
    <nav className="toolbar" aria-label="Board tools">
      <button
        className="button button-primary"
        type="button"
        onClick={onAddNote}
      >
        <span aria-hidden="true">＋</span> Add note
      </button>

      <div className="toolbar-group" role="group" aria-label="History">
        <button type="button" disabled={!canUndo} onClick={onUndo}>
          Undo
        </button>
        <button type="button" disabled={!canRedo} onClick={onRedo}>
          Redo
        </button>
      </div>

      <div
        className="toolbar-group pan-controls"
        role="group"
        aria-label="Pan board"
      >
        <button
          type="button"
          aria-label="Pan left"
          onClick={() => onPan(80, 0)}
        >
          ←
        </button>
        <button type="button" aria-label="Pan up" onClick={() => onPan(0, 80)}>
          ↑
        </button>
        <button
          type="button"
          aria-label="Pan down"
          onClick={() => onPan(0, -80)}
        >
          ↓
        </button>
        <button
          type="button"
          aria-label="Pan right"
          onClick={() => onPan(-80, 0)}
        >
          →
        </button>
      </div>

      <div className="toolbar-group" role="group" aria-label="Zoom controls">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => onZoom(-0.1)}
        >
          −
        </button>
        <output aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label="Zoom in" onClick={() => onZoom(0.1)}>
          +
        </button>
      </div>

      <button type="button" onClick={onResetView}>
        Reset view
      </button>
    </nav>
  );
}
