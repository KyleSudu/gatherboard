import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  applyBoardOperation,
  boardRecordSchema,
  type BoardOperation,
  type BoardRecord,
  type SaveBoardInput,
} from "../../shared";

type BoardRow = {
  id: string;
  title: string;
  document_json: string;
  viewport_json: string;
  created_at: string;
  updated_at: string;
  revision: number;
};

function rowToBoard(row: BoardRow): BoardRecord {
  return boardRecordSchema.parse({
    id: row.id,
    title: row.title,
    document: JSON.parse(row.document_json),
    viewport: JSON.parse(row.viewport_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  });
}

/** Stores validated board snapshots while keeping SQLite details behind a small repository boundary. */
export class BoardRepository {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        document_json TEXT NOT NULL,
        viewport_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const columns = this.database
      .prepare("PRAGMA table_info(boards)")
      .all() as {
      name: string;
    }[];
    if (!columns.some(({ name }) => name === "revision")) {
      this.database.exec(
        "ALTER TABLE boards ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
      );
    }
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS board_operations (
        operation_id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        operation_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (board_id) REFERENCES boards(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS board_operations_board_revision
      ON board_operations(board_id, revision);
    `);
  }

  create(input: SaveBoardInput): BoardRecord {
    const now = new Date().toISOString();
    const board: BoardRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
      revision: 0,
    };

    this.database
      .prepare(
        `INSERT INTO boards
          (id, title, document_json, viewport_json, created_at, updated_at, revision)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        board.id,
        board.title,
        JSON.stringify(board.document),
        JSON.stringify(board.viewport),
        board.createdAt,
        board.updatedAt,
        board.revision,
      );

    return board;
  }

  findById(id: string): BoardRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM boards WHERE id = ?")
      .get(id) as BoardRow | undefined;
    return row ? rowToBoard(row) : undefined;
  }

  update(id: string, input: SaveBoardInput): BoardRecord | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    this.database
      .prepare(
        `UPDATE boards
         SET title = ?, document_json = ?, viewport_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.title,
        JSON.stringify(input.document),
        JSON.stringify(input.viewport),
        updatedAt,
        id,
      );

    return {
      id,
      ...input,
      createdAt: existing.createdAt,
      updatedAt,
      revision: existing.revision,
    };
  }

  commitOperation(
    operation: BoardOperation,
  ): { board: BoardRecord; revision: number; duplicate: boolean } | undefined {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.database
        .prepare("SELECT revision FROM board_operations WHERE operation_id = ?")
        .get(operation.operationId) as { revision: number } | undefined;
      if (previous) {
        const board = this.findById(operation.boardId);
        this.database.exec("COMMIT");
        return board
          ? { board, revision: previous.revision, duplicate: true }
          : undefined;
      }

      const existing = this.findById(operation.boardId);
      if (!existing) {
        this.database.exec("ROLLBACK");
        return undefined;
      }

      const applied = applyBoardOperation(
        { title: existing.title, document: existing.document },
        operation,
      );
      const revision = existing.revision + 1;
      const updatedAt = new Date().toISOString();

      this.database
        .prepare(
          `INSERT INTO board_operations
            (operation_id, board_id, client_id, revision, operation_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          operation.operationId,
          operation.boardId,
          operation.clientId,
          revision,
          JSON.stringify(operation),
          updatedAt,
        );
      this.database
        .prepare(
          `UPDATE boards
           SET title = ?, document_json = ?, updated_at = ?, revision = ?
           WHERE id = ?`,
        )
        .run(
          applied.title,
          JSON.stringify(applied.document),
          updatedAt,
          revision,
          operation.boardId,
        );
      this.database.exec("COMMIT");

      return {
        board: {
          ...existing,
          title: applied.title,
          document: applied.document,
          updatedAt,
          revision,
        },
        revision,
        duplicate: false,
      };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}
