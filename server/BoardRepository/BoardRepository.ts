import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  boardRecordSchema,
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
};

function rowToBoard(row: BoardRow): BoardRecord {
  return boardRecordSchema.parse({
    id: row.id,
    title: row.title,
    document: JSON.parse(row.document_json),
    viewport: JSON.parse(row.viewport_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  }

  create(input: SaveBoardInput): BoardRecord {
    const now = new Date().toISOString();
    const board: BoardRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.database
      .prepare(
        `INSERT INTO boards
          (id, title, document_json, viewport_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        board.id,
        board.title,
        JSON.stringify(board.document),
        JSON.stringify(board.viewport),
        board.createdAt,
        board.updatedAt,
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
    };
  }

  close() {
    this.database.close();
  }
}
