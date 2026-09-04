import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import type {
  BoardOperation,
  SaveBoardInput,
  ServerMessage,
} from "../../shared";
import { BoardRepository } from "../BoardRepository";
import { createBoardServer } from "./createBoardServer";

const boardInput: SaveBoardInput = {
  title: "Planning board",
  document: {
    notes: [
      {
        id: "first",
        text: "Start small",
        color: "yellow",
        position: { x: 20, y: 30 },
      },
    ],
  },
  viewport: { x: 0, y: 0, zoom: 1 },
};

const repositories: BoardRepository[] = [];

function createTestServer() {
  const repository = new BoardRepository(":memory:");
  repositories.push(repository);
  return createBoardServer(repository);
}

function messageInbox(socket: WebSocket) {
  const messages: ServerMessage[] = [];
  const listeners = new Set<() => void>();
  socket.on("message", (raw) => {
    messages.push(JSON.parse(raw.toString()) as ServerMessage);
    for (const listener of listeners) listener();
  });

  return function next(
    predicate: (message: ServerMessage) => boolean,
  ): Promise<ServerMessage> {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out waiting for WebSocket message")),
        2_000,
      );
      const check = () => {
        const message = messages.find(predicate);
        if (!message) return;
        clearTimeout(timeout);
        listeners.delete(check);
        resolve(message);
      };
      listeners.add(check);
    });
  };
}

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close();
});

describe("board API", () => {
  it("creates, loads, and updates a board", async () => {
    const server = createTestServer();
    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/boards",
      payload: boardInput,
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json();

    const loadedResponse = await server.inject({
      method: "GET",
      url: `/api/boards/${created.id}`,
    });
    expect(loadedResponse.json()).toMatchObject(boardInput);

    const updatedResponse = await server.inject({
      method: "PUT",
      url: `/api/boards/${created.id}`,
      payload: { ...boardInput, title: "Renamed board" },
    });
    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json()).toMatchObject({ title: "Renamed board" });

    await server.close();
  });

  it("rejects invalid board data at the HTTP boundary", async () => {
    const server = createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/boards",
      payload: {
        ...boardInput,
        viewport: { x: 0, y: 0, zoom: 99 },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Invalid board" });
    await server.close();
  });

  it("returns a clear response for a missing board", async () => {
    const server = createTestServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/boards/1b2dcdf3-7c07-4dc2-8818-318e46cb42cd",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Board not found" });
    await server.close();
  });

  it("broadcasts one ordered operation to two clients and deduplicates retries", async () => {
    const repository = new BoardRepository(":memory:");
    repositories.push(repository);
    const server = createBoardServer(repository);
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    if (!address || typeof address === "string") throw new Error("No port");

    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/boards",
      payload: boardInput,
    });
    const boardId = createdResponse.json().id as string;
    const firstClientId = "66aae455-8ca4-4e05-9e3c-7eb8221f573f";
    const secondClientId = "ba02dc0a-6296-45dc-9689-bd97f4317ce2";
    const connect = (clientId: string, name: string) =>
      new WebSocket(
        `ws://127.0.0.1:${address.port}/api/boards/${boardId}/live?clientId=${clientId}&displayName=${name}`,
      );
    const first = connect(firstClientId, "First");
    const second = connect(secondClientId, "Second");
    const firstInbox = messageInbox(first);
    const secondInbox = messageInbox(second);
    await Promise.all([
      firstInbox(({ type }) => type === "sync"),
      secondInbox(({ type }) => type === "sync"),
    ]);

    const cursorUpdate = secondInbox(
      (message) =>
        message.type === "cursor.updated" &&
        message.participant.clientId === firstClientId,
    );
    first.send(JSON.stringify({ type: "cursor", cursor: { x: 120, y: 240 } }));
    expect(await cursorUpdate).toMatchObject({
      participant: { cursor: { x: 120, y: 240 } },
    });

    const operation: BoardOperation = {
      type: "note.textChanged",
      operationId: "c75c6c52-35cc-44c6-918c-80aa78ac11d7",
      boardId,
      clientId: firstClientId,
      clientSequence: 0,
      payload: { noteId: "first", text: "Changed together" },
    };
    const firstCommit = firstInbox(
      (message) =>
        message.type === "operation.committed" &&
        message.operation.operationId === operation.operationId,
    );
    const secondCommit = secondInbox(
      (message) =>
        message.type === "operation.committed" &&
        message.operation.operationId === operation.operationId,
    );
    first.send(JSON.stringify({ type: "operation", operation }));

    const [firstMessage, secondMessage] = await Promise.all([
      firstCommit,
      secondCommit,
    ]);
    expect(firstMessage).toMatchObject({ revision: 1 });
    expect(secondMessage).toMatchObject({ revision: 1 });
    expect(repository.findById(boardId)).toMatchObject({
      revision: 1,
      document: { notes: [{ text: "Changed together" }] },
    });

    first.send(JSON.stringify({ type: "operation", operation }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(repository.findById(boardId)?.revision).toBe(1);

    first.close();
    second.close();
    await server.close();
  });
});
