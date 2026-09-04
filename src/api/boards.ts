import {
  boardRecordSchema,
  type BoardRecord,
  type SaveBoardInput,
} from "../../shared";

export class BoardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readBoardResponse(response: Response): Promise<BoardRecord> {
  if (!response.ok) {
    throw new BoardApiError(
      response.status === 404 ? "Board not found" : "Board request failed",
      response.status,
    );
  }
  return boardRecordSchema.parse(await response.json());
}

export async function createBoard(input: SaveBoardInput) {
  return readBoardResponse(
    await fetch("/api/boards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getBoard(boardId: string) {
  return readBoardResponse(await fetch(`/api/boards/${boardId}`));
}

export async function saveBoard(boardId: string, input: SaveBoardInput) {
  return readBoardResponse(
    await fetch(`/api/boards/${boardId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
