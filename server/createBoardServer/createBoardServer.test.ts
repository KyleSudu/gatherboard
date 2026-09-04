import { afterEach, describe, expect, it } from "vitest";

import type { SaveBoardInput } from "../../shared";
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
});
