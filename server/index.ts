import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import staticFiles from "@fastify/static";

import { BoardRepository } from "./BoardRepository";
import { createBoardServer } from "./createBoardServer";

const databasePath = resolve(
  process.env.BOARD_DB_PATH ?? "server/data/gatherboard.db",
);
mkdirSync(dirname(databasePath), { recursive: true });

const repository = new BoardRepository(databasePath);
const server = createBoardServer(repository, true);
const staticRoot = resolve("dist");

if (existsSync(staticRoot)) {
  await server.register(staticFiles, { root: staticRoot });
  server.get("/boards/:id", async (_request, reply) => {
    return reply.sendFile("index.html");
  });
}

server.addHook("onClose", async () => repository.close());

await server.listen({
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 4175),
});
