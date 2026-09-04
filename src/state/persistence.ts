import type { PersistedBoard } from "../domain/board";

export const STORAGE_KEY = "gatherboard:v0";

export function loadPersistedBoard(): PersistedBoard | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return undefined;
    return JSON.parse(value) as PersistedBoard;
  } catch {
    return undefined;
  }
}

export function savePersistedBoard(board: PersistedBoard) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}
