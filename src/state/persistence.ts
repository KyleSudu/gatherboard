import type { PersistedBoard } from "../domain/board";

export const STORAGE_KEY = "gatherboard:v0";

function boardIdFromPath() {
  const match = window.location.pathname.match(/^\/boards\/([^/]+)$/);
  return match?.[1] ?? "draft";
}

let activeBoardId = typeof window === "undefined" ? "draft" : boardIdFromPath();

function currentStorageKey() {
  return `${STORAGE_KEY}:${activeBoardId}`;
}

export function setLocalBoardId(boardId: string) {
  activeBoardId = boardId;
}

export function loadPersistedBoard(): PersistedBoard | undefined {
  try {
    const value = window.localStorage.getItem(currentStorageKey());
    if (!value) return undefined;
    return JSON.parse(value) as PersistedBoard;
  } catch {
    return undefined;
  }
}

export function savePersistedBoard(board: PersistedBoard) {
  const previous = loadPersistedBoard();
  window.localStorage.setItem(
    currentStorageKey(),
    JSON.stringify({
      ...board,
      title: board.title ?? previous?.title,
    }),
  );
}
