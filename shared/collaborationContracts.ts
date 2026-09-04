import { z } from "zod";

import {
  boardRecordSchema,
  noteColorSchema,
  pointSchema,
  stickyNoteSchema,
} from "./boardContracts";

const operationBaseSchema = z.object({
  operationId: z.string().uuid(),
  boardId: z.string().uuid(),
  clientId: z.string().uuid(),
  clientSequence: z.number().int().nonnegative(),
});

export const boardOperationSchema = z.discriminatedUnion("type", [
  operationBaseSchema.extend({
    type: z.literal("note.created"),
    payload: z.object({ note: stickyNoteSchema }),
  }),
  operationBaseSchema.extend({
    type: z.literal("note.moved"),
    payload: z.object({ noteId: z.string().min(1), position: pointSchema }),
  }),
  operationBaseSchema.extend({
    type: z.literal("note.textChanged"),
    payload: z.object({
      noteId: z.string().min(1),
      text: z.string().max(5_000),
    }),
  }),
  operationBaseSchema.extend({
    type: z.literal("note.colorChanged"),
    payload: z.object({ noteId: z.string().min(1), color: noteColorSchema }),
  }),
  operationBaseSchema.extend({
    type: z.literal("note.deleted"),
    payload: z.object({ noteId: z.string().min(1) }),
  }),
  operationBaseSchema.extend({
    type: z.literal("board.titleChanged"),
    payload: z.object({ title: z.string().trim().min(1).max(80) }),
  }),
]);

export const participantSchema = z.object({
  clientId: z.string().uuid(),
  displayName: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  cursor: pointSchema.nullable(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("operation"), operation: boardOperationSchema }),
  z.object({ type: z.literal("cursor"), cursor: pointSchema.nullable() }),
  z.object({ type: z.literal("ping") }),
]);

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("sync"),
    board: boardRecordSchema,
    participants: z.array(participantSchema),
  }),
  z.object({
    type: z.literal("operation.committed"),
    operation: boardOperationSchema,
    revision: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("operation.rejected"),
    operationId: z.string().uuid(),
    reason: z.string(),
    board: boardRecordSchema,
  }),
  z.object({
    type: z.literal("presence.updated"),
    participants: z.array(participantSchema),
  }),
  z.object({
    type: z.literal("cursor.updated"),
    participant: participantSchema,
  }),
  z.object({ type: z.literal("pong") }),
]);

export type BoardOperation = z.infer<typeof boardOperationSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
