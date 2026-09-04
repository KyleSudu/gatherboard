import { configureStore } from "@reduxjs/toolkit";

import {
  boardReducer,
  hydrateBoard,
  type PersistedBoard,
} from "../domain/board";
import { loadPersistedBoard, savePersistedBoard } from "./persistence";

export function createAppStore(persistedBoard?: PersistedBoard) {
  const store = configureStore({
    reducer: {
      board: boardReducer,
    },
  });

  if (persistedBoard) store.dispatch(hydrateBoard(persistedBoard));

  return store;
}

export const store = createAppStore(loadPersistedBoard());

if (typeof window !== "undefined") {
  store.subscribe(() => {
    const { present, viewport } = store.getState().board;
    savePersistedBoard({ document: present, viewport });
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
