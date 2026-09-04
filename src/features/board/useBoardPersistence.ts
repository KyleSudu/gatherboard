import { useEffect, useRef, useState } from "react";

import { createBoard, getBoard, saveBoard } from "../../api";
import { hydrateBoard } from "../../domain/board";
import {
  loadPersistedBoard,
  savePersistedBoard,
  setLocalBoardId,
  useAppDispatch,
  useAppSelector,
} from "../../state";
import type { BoardRecord, SaveBoardInput } from "../../../shared";

export type SyncStatus = "loading" | "saving" | "saved" | "offline" | "error";

function boardIdFromPath() {
  const match = window.location.pathname.match(/^\/boards\/([^/]+)$/);
  return match?.[1];
}

function snapshot(input: SaveBoardInput) {
  return JSON.stringify(input);
}

/** Owns the client/server synchronization lifecycle while Redux remains focused on board interactions. */
export function useBoardPersistence(enabled = true) {
  const dispatch = useAppDispatch();
  const { present, viewport } = useAppSelector((state) => state.board);
  const startingBoard = useRef({ document: present, viewport });
  const lastSynced = useRef("");
  const loaded = useRef(false);
  const loadRequest = useRef<{
    attempt: number;
    pathBoardId?: string;
    promise: Promise<BoardRecord>;
  } | null>(null);
  const [boardId, setBoardId] = useState<string | undefined>(() =>
    enabled ? boardIdFromPath() : "test-board",
  );
  const [title, setTitle] = useState(() =>
    enabled
      ? (loadPersistedBoard()?.title ?? "Untitled board")
      : "Untitled board",
  );
  const [status, setStatus] = useState<SyncStatus>(
    enabled ? "loading" : "saved",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function loadBoard() {
      try {
        const pathBoardId = boardIdFromPath();
        if (loadRequest.current?.attempt !== loadAttempt) {
          loadRequest.current = {
            attempt: loadAttempt,
            pathBoardId,
            promise: pathBoardId
              ? getBoard(pathBoardId)
              : createBoard({
                  title: "Untitled board",
                  ...startingBoard.current,
                }),
          };
        }
        const board = await loadRequest.current.promise;
        if (cancelled) return;

        if (!loadRequest.current.pathBoardId) {
          window.history.replaceState({}, "", `/boards/${board.id}`);
        }

        const input = {
          title: board.title,
          document: board.document,
          viewport: board.viewport,
        };
        setLocalBoardId(board.id);
        savePersistedBoard({
          document: board.document,
          viewport: board.viewport,
          title: board.title,
        });
        dispatch(
          hydrateBoard({ document: board.document, viewport: board.viewport }),
        );
        lastSynced.current = snapshot(input);
        loaded.current = true;
        setBoardId(board.id);
        setTitle(board.title);
        setStatus("saved");
      } catch (error) {
        if (cancelled) return;
        loaded.current = false;
        const offline = !window.navigator.onLine || error instanceof TypeError;
        setStatus(offline ? "offline" : "error");
        setErrorMessage(
          offline
            ? "The server is unavailable. Your local board is still usable."
            : error instanceof Error
              ? error.message
              : "The board could not be opened.",
        );
      }
    }

    void loadBoard();
    return () => {
      cancelled = true;
    };
  }, [dispatch, enabled, loadAttempt]);

  useEffect(() => {
    if (!enabled || !loaded.current || !boardId) return;
    const input = {
      title: title.trim() || "Untitled board",
      document: present,
      viewport,
    };
    const nextSnapshot = snapshot(input);
    if (nextSnapshot === lastSynced.current) return;
    savePersistedBoard({ ...input });

    const timeout = window.setTimeout(async () => {
      if (!window.navigator.onLine) {
        setStatus("offline");
        setErrorMessage(
          "You are offline. Changes remain saved on this device.",
        );
        return;
      }

      setStatus("saving");
      try {
        await saveBoard(boardId, input);
        lastSynced.current = nextSnapshot;
        setStatus("saved");
        setErrorMessage("");
      } catch (error) {
        const offline = !window.navigator.onLine || error instanceof TypeError;
        setStatus(offline ? "offline" : "error");
        setErrorMessage(
          offline
            ? "The server is unavailable. Changes remain saved on this device."
            : error instanceof Error
              ? error.message
              : "Changes could not be saved.",
        );
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [boardId, enabled, present, saveAttempt, title, viewport]);

  useEffect(() => {
    if (!enabled) return;
    const handleOffline = () => {
      setStatus("offline");
      setErrorMessage("You are offline. Changes remain saved on this device.");
    };
    const handleOnline = () => {
      if (loaded.current) setSaveAttempt((attempt) => attempt + 1);
      else setLoadAttempt((attempt) => attempt + 1);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled]);

  return {
    boardId,
    errorMessage,
    retry: () => {
      if (loaded.current) setSaveAttempt((attempt) => attempt + 1);
      else {
        setStatus("loading");
        setErrorMessage("");
        setLoadAttempt((attempt) => attempt + 1);
      }
    },
    status,
    title,
    renameBoard: setTitle,
  };
}
