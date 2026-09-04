import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { BoardRepository } from "./BoardRepository";
import { createBoardServer } from "./createBoardServer";

const databasePath = resolve(
  process.env.BOARD_DB_PATH ?? "server/data/gatherboard.db",
);
mkdirSync(dirname(databasePath), { recursive: true });

const repository = new BoardRepository(databasePath);
const server = createBoardServer(repository, true);

server.addHook("onClose", async () => repository.close());

await server.listen({ host: "127.0.0.1", port: 4175 });
