import websocket from "@fastify/websocket";
import Fastify from "fastify";
import type WebSocket from "ws";
import { z } from "zod";

import {
  clientMessageSchema,
  saveBoardInputSchema,
  type Participant,
  type ServerMessage,
} from "../../shared";
import { BoardRepository } from "../BoardRepository";

const boardParamsSchema = z.object({ id: z.string().uuid() });
const connectionQuerySchema = z.object({
  clientId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(40),
});

type Connection = {
  socket: WebSocket;
  participant: Participant;
};

const participantColors = [
  "#6847d6",
  "#d64978",
  "#197d68",
  "#bf6516",
  "#3268cc",
];

function participantColor(clientId: string) {
  const hash = [...clientId].reduce((total, character) => {
    return (total + character.charCodeAt(0)) % participantColors.length;
  }, 0);
  return participantColors[hash];
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

/** Creates the HTTP boundary that validates requests before reading or writing board snapshots. */
export function createBoardServer(repository: BoardRepository, logger = false) {
  const server = Fastify({ logger });
  const rooms = new Map<string, Map<string, Connection>>();

  server.get("/health", async () => ({ status: "ok" }));

  server.post("/api/boards", async (request, reply) => {
    const parsed = saveBoardInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid board",
        issues: parsed.error.issues,
      });
    }

    return reply.status(201).send(repository.create(parsed.data));
  });

  server.get("/api/boards/:id", async (request, reply) => {
    const parsedParams = boardParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ error: "Invalid board id" });
    }

    const board = repository.findById(parsedParams.data.id);
    if (!board) return reply.status(404).send({ error: "Board not found" });
    return board;
  });

  server.put("/api/boards/:id", async (request, reply) => {
    const parsedParams = boardParamsSchema.safeParse(request.params);
    const parsedBody = saveBoardInputSchema.safeParse(request.body);
    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({ error: "Invalid board update" });
    }

    const board = repository.update(parsedParams.data.id, parsedBody.data);
    if (!board) return reply.status(404).send({ error: "Board not found" });
    return board;
  });

  server.register(async (liveServer) => {
    await liveServer.register(websocket);
    liveServer.get(
      "/api/boards/:id/live",
      { websocket: true },
      (socket, request) => {
        const params = boardParamsSchema.safeParse(request.params);
        const query = connectionQuerySchema.safeParse(request.query);
        const board = params.success
          ? repository.findById(params.data.id)
          : undefined;
        if (!params.success || !query.success || !board) {
          socket.close(1008, "Invalid collaboration session");
          return;
        }

        const { id: boardId } = params.data;
        const { clientId, displayName } = query.data;
        const participant: Participant = {
          clientId,
          displayName,
          color: participantColor(clientId),
          cursor: null,
        };
        const room = rooms.get(boardId) ?? new Map<string, Connection>();
        rooms.set(boardId, room);
        const previous = room.get(clientId);
        if (previous) previous.socket.close(1000, "Reconnected elsewhere");
        const connection = { socket, participant };
        room.set(clientId, connection);

        const participants = () =>
          [...room.values()].map(({ participant: current }) => current);
        const broadcast = (message: ServerMessage) => {
          for (const { socket: clientSocket } of room.values()) {
            send(clientSocket, message);
          }
        };

        send(socket, { type: "sync", board, participants: participants() });
        broadcast({ type: "presence.updated", participants: participants() });

        socket.on("message", (rawMessage) => {
          let json: unknown;
          try {
            json = JSON.parse(rawMessage.toString());
          } catch {
            return;
          }
          const message = clientMessageSchema.safeParse(json);
          if (!message.success) return;

          if (message.data.type === "ping") {
            send(socket, { type: "pong" });
            return;
          }

          if (message.data.type === "cursor") {
            participant.cursor = message.data.cursor;
            broadcast({ type: "cursor.updated", participant });
            return;
          }

          const { operation } = message.data;
          if (
            operation.boardId !== boardId ||
            operation.clientId !== clientId
          ) {
            const currentBoard = repository.findById(boardId);
            if (currentBoard) {
              send(socket, {
                type: "operation.rejected",
                operationId: operation.operationId,
                reason: "Operation identity does not match this connection",
                board: currentBoard,
              });
            }
            return;
          }

          const committed = repository.commitOperation(operation);
          if (!committed) return;
          const event: ServerMessage = {
            type: "operation.committed",
            operation,
            revision: committed.revision,
          };
          if (committed.duplicate) send(socket, event);
          else broadcast(event);
        });

        socket.on("close", () => {
          if (room.get(clientId) !== connection) return;
          room.delete(clientId);
          if (room.size === 0) rooms.delete(boardId);
          else
            broadcast({
              type: "presence.updated",
              participants: participants(),
            });
        });
      },
    );
  });

  return server;
}
