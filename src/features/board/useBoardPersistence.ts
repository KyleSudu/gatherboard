import { useEffect, useRef, useState } from "react";

import { createBoard, getBoard } from "../../api";
import { hydrateBoard } from "../../domain/board";
import {
  savePersistedBoard,
  setLocalBoardId,
  useAppDispatch,
  useAppSelector,
} from "../../state";
import type { BoardRecord } from "../../../shared";

export type LoadStatus = "loading" | "ready" | "offline" | "error";

function boardIdFromPath() {
  const match = window.location.pathname.match(/^\/boards\/([^/]+)$/);
  return match?.[1];
}

/** Creates or loads the initial snapshot; live changes belong to the collaboration hook. */
export function useBoardPersistence(enabled = true) {
  const dispatch = useAppDispatch();
  const { present, revision, title, viewport } = useAppSelector(
    (state) => state.board,
  );
  const startingBoard = useRef({ document: present, viewport, title });
  const loadRequest = useRef<{
    attempt: number;
    pathBoardId?: string;
    promise: Promise<BoardRecord>;
  } | null>(null);
  const [boardId, setBoardId] = useState<string | undefined>(() =>
    enabled ? boardIdFromPath() : "1b2dcdf3-7c07-4dc2-8818-318e46cb42cd",
  );
  const [status, setStatus] = useState<LoadStatus>(
    enabled ? "loading" : "ready",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

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
                  title: startingBoard.current.title,
                  document: startingBoard.current.document,
                  viewport: startingBoard.current.viewport,
                }),
          };
        }
        const board = await loadRequest.current.promise;
        if (cancelled) return;

        if (!loadRequest.current.pathBoardId) {
          window.history.replaceState({}, "", `/boards/${board.id}`);
        }

        setLocalBoardId(board.id);
        savePersistedBoard({
          document: board.document,
          viewport: board.viewport,
          title: board.title,
          revision: board.revision,
        });
        dispatch(
          hydrateBoard({
            document: board.document,
            viewport: board.viewport,
            title: board.title,
            revision: board.revision,
          }),
        );
        setBoardId(board.id);
        setStatus("ready");
        setErrorMessage("");
      } catch (error) {
        if (cancelled) return;
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
    if (!enabled) return;
    const retryWhenOnline = () => setLoadAttempt((attempt) => attempt + 1);
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [enabled]);

  return {
    boardId,
    errorMessage,
    ready: status === "ready",
    revision,
    retry: () => {
      setStatus("loading");
      setErrorMessage("");
      setLoadAttempt((attempt) => attempt + 1);
    },
    status,
  };
}
