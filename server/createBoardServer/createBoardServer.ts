import Fastify from "fastify";
import { z } from "zod";

import { saveBoardInputSchema } from "../../shared";
import { BoardRepository } from "../BoardRepository";

const boardParamsSchema = z.object({ id: z.string().uuid() });

/** Creates the HTTP boundary that validates requests before reading or writing board snapshots. */
export function createBoardServer(repository: BoardRepository, logger = false) {
  const server = Fastify({ logger });

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

  return server;
}
