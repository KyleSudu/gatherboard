import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyCollaborationOperation,
  hydrateBoard,
  setRevision,
  type NoteColor,
  type Point,
  type StickyNote,
} from "../../domain/board";
import { useAppDispatch, useAppSelector } from "../../state";
import {
  applyBoardOperation,
  boardOperationSchema,
  serverMessageSchema,
  type BoardOperation,
  type Participant,
} from "../../../shared";

type OperationDraft = {
  type: BoardOperation["type"];
  payload: unknown;
};

export type CollaborationStatus =
  "disabled" | "connecting" | "live" | "reconnecting" | "offline" | "error";

function getClientIdentity() {
  const storedId = window.sessionStorage.getItem("gatherboard:client-id");
  const clientId = storedId ?? crypto.randomUUID();
  if (!storedId)
    window.sessionStorage.setItem("gatherboard:client-id", clientId);
  return {
    clientId,
    displayName: `Guest ${clientId.slice(0, 4).toUpperCase()}`,
  };
}

function inverseFor(
  title: string,
  notes: StickyNote[],
  draft: OperationDraft,
): OperationDraft | undefined {
  const payload = draft.payload as Record<string, unknown>;
  const noteId = payload.noteId as string | undefined;
  const note = noteId ? notes.find(({ id }) => id === noteId) : undefined;

  switch (draft.type) {
    case "note.created":
      return {
        type: "note.deleted",
        payload: { noteId: (payload.note as StickyNote).id },
      };
    case "note.deleted":
      return note
        ? { type: "note.created", payload: { note: structuredClone(note) } }
        : undefined;
    case "note.moved":
      return note
        ? { type: "note.moved", payload: { noteId, position: note.position } }
        : undefined;
    case "note.textChanged":
      return note
        ? { type: "note.textChanged", payload: { noteId, text: note.text } }
        : undefined;
    case "note.colorChanged":
      return note
        ? { type: "note.colorChanged", payload: { noteId, color: note.color } }
        : undefined;
    case "board.titleChanged":
      return { type: "board.titleChanged", payload: { title } };
  }
}

type UseBoardCollaborationOptions = {
  boardId?: string;
  enabled: boolean;
  ready: boolean;
};

/** Turns local commands into optimistic operations and reconciles them with server revisions. */
export function useBoardCollaboration({
  boardId,
  enabled,
  ready,
}: UseBoardCollaborationOptions) {
  const dispatch = useAppDispatch();
  const board = useAppSelector((state) => state.board);
  const boardRef = useRef(board);
  const [identity] = useState(getClientIdentity);
  const socketRef = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, BoardOperation>());
  const undoStack = useRef<OperationDraft[]>([]);
  const redoStack = useRef<OperationDraft[]>([]);
  const sequence = useRef(0);
  const revision = useRef(board.revision);
  const reconnectCount = useRef(0);
  const cursorSentAt = useRef(0);
  const [historyAvailability, setHistoryAvailability] = useState({
    canRedo: false,
    canUndo: false,
  });
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<CollaborationStatus>(
    enabled ? "connecting" : "disabled",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    boardRef.current = board;
    revision.current = board.revision;
  }, [board]);

  useEffect(() => {
    if (!enabled || !ready || !boardId) return;
    let disposed = false;
    let reconnectTimer: number | undefined;
    let heartbeat: number | undefined;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const query = new URLSearchParams(identity);
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/api/boards/${boardId}/live?${query}`,
    );
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      heartbeat = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 20_000);
    });

    socket.addEventListener("message", (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const parsed = serverMessageSchema.safeParse(data);
      if (!parsed.success || disposed || socketRef.current !== socket) return;
      const message = parsed.data;

      if (message.type === "sync") {
        revision.current = message.board.revision;
        dispatch(
          hydrateBoard({
            document: message.board.document,
            viewport: message.board.viewport,
            title: message.board.title,
            revision: message.board.revision,
          }),
        );
        for (const operation of pending.current.values()) {
          dispatch(applyCollaborationOperation(operation));
          socket.send(JSON.stringify({ type: "operation", operation }));
        }
        setParticipants(message.participants);
        reconnectCount.current = 0;
        setStatus("live");
        setErrorMessage("");
        return;
      }

      if (message.type === "operation.committed") {
        if (message.revision <= revision.current) {
          pending.current.delete(message.operation.operationId);
          return;
        }
        if (message.revision !== revision.current + 1) {
          setErrorMessage("A revision was missed. Reconnecting to catch up.");
          socket.close(1012, "Revision gap");
          return;
        }

        revision.current = message.revision;
        dispatch(setRevision(message.revision));
        if (message.operation.clientId === identity.clientId) {
          pending.current.delete(message.operation.operationId);
        } else {
          dispatch(applyCollaborationOperation(message.operation));
          for (const operation of pending.current.values()) {
            dispatch(applyCollaborationOperation(operation));
          }
        }
        return;
      }

      if (message.type === "operation.rejected") {
        pending.current.delete(message.operationId);
        revision.current = message.board.revision;
        dispatch(
          hydrateBoard({
            document: message.board.document,
            viewport: message.board.viewport,
            title: message.board.title,
            revision: message.board.revision,
          }),
        );
        for (const operation of pending.current.values()) {
          dispatch(applyCollaborationOperation(operation));
          socket.send(JSON.stringify({ type: "operation", operation }));
        }
        setStatus("error");
        setErrorMessage(message.reason);
        return;
      }

      if (message.type === "presence.updated") {
        setParticipants(message.participants);
        return;
      }

      if (message.type === "cursor.updated") {
        setParticipants((current) => {
          const others = current.filter(
            ({ clientId }) => clientId !== message.participant.clientId,
          );
          return [...others, message.participant];
        });
      }
    });

    socket.addEventListener("close", () => {
      if (disposed) return;
      socketRef.current = null;
      setParticipants([]);
      if (heartbeat) window.clearInterval(heartbeat);
      const offline = !window.navigator.onLine;
      setStatus(offline ? "offline" : "reconnecting");
      reconnectCount.current += 1;
      const delay = Math.min(5_000, 300 * 2 ** reconnectCount.current);
      reconnectTimer = window.setTimeout(
        () => setConnectionAttempt((attempt) => attempt + 1),
        delay,
      );
    });

    socket.addEventListener("error", () => {
      setErrorMessage("The live connection was interrupted.");
    });

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (heartbeat) window.clearInterval(heartbeat);
      socket.close(1000, "Client closed");
    };
  }, [boardId, connectionAttempt, dispatch, enabled, identity, ready]);

  useEffect(() => {
    if (!enabled) return;
    const handleOffline = () => {
      setStatus("offline");
      socketRef.current?.close(1000, "Browser offline");
    };
    const handleOnline = () => setConnectionAttempt((attempt) => attempt + 1);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled]);

  const commitDraft = useCallback(
    (draft: OperationDraft, recordHistory = true) => {
      if (!boardId) return;
      const current = boardRef.current;
      const target = { title: current.title, document: current.present };
      const operationPreview = boardOperationSchema.parse({
        ...draft,
        operationId: crypto.randomUUID(),
        boardId,
        clientId: identity.clientId,
        clientSequence: sequence.current,
      });
      const preview = applyBoardOperation(target, operationPreview);
      if (preview === target) return;
      const inverse = inverseFor(current.title, current.present.notes, draft);
      const operation = operationPreview;
      sequence.current += 1;

      dispatch(applyCollaborationOperation(operation));
      if (enabled) {
        pending.current.set(operation.operationId, operation);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({ type: "operation", operation }),
          );
        } else {
          setStatus("offline");
        }
      }

      if (recordHistory && inverse) {
        undoStack.current.push(inverse);
        redoStack.current = [];
        setHistoryAvailability({
          canRedo: false,
          canUndo: undoStack.current.length > 0,
        });
      }
    },
    [boardId, dispatch, enabled, identity.clientId],
  );

  const undo = useCallback(() => {
    const inverse = undoStack.current.pop();
    if (!inverse) return;
    const current = boardRef.current;
    const redo = inverseFor(current.title, current.present.notes, inverse);
    commitDraft(inverse, false);
    if (redo) redoStack.current.push(redo);
    setHistoryAvailability({
      canRedo: redoStack.current.length > 0,
      canUndo: undoStack.current.length > 0,
    });
  }, [commitDraft]);

  const redo = useCallback(() => {
    const operation = redoStack.current.pop();
    if (!operation) return;
    const current = boardRef.current;
    const inverse = inverseFor(current.title, current.present.notes, operation);
    commitDraft(operation, false);
    if (inverse) undoStack.current.push(inverse);
    setHistoryAvailability({
      canRedo: redoStack.current.length > 0,
      canUndo: undoStack.current.length > 0,
    });
  }, [commitDraft]);

  const sendCursor = useCallback((cursor: Point | null) => {
    const now = Date.now();
    if (now - cursorSentAt.current < 70) return;
    cursorSentAt.current = now;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "cursor", cursor }));
    }
  }, []);

  return {
    canRedo: historyAvailability.canRedo,
    canUndo: historyAvailability.canUndo,
    changeColor: (id: string, color: NoteColor) =>
      commitDraft({
        type: "note.colorChanged",
        payload: { noteId: id, color },
      }),
    changeText: (id: string, text: string) =>
      commitDraft({
        type: "note.textChanged",
        payload: { noteId: id, text },
      }),
    createNote: (note: StickyNote) =>
      commitDraft({ type: "note.created", payload: { note } }),
    deleteNote: (id: string) =>
      commitDraft({ type: "note.deleted", payload: { noteId: id } }),
    errorMessage,
    clientId: identity.clientId,
    moveNote: (id: string, position: Point) =>
      commitDraft({ type: "note.moved", payload: { noteId: id, position } }),
    participants,
    redo,
    renameBoard: (title: string) =>
      commitDraft({ type: "board.titleChanged", payload: { title } }),
    retry: () => setConnectionAttempt((attempt) => attempt + 1),
    sendCursor,
    status,
    undo,
  };
}
