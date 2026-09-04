import { z } from "zod";

export const noteColorSchema = z.enum(["yellow", "pink", "blue", "green"]);

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const stickyNoteSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().max(5_000),
  color: noteColorSchema,
  position: pointSchema,
});

export const boardDocumentSchema = z.object({
  notes: z.array(stickyNoteSchema).max(500),
});

export const viewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().min(0.5).max(2),
});

export const saveBoardInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  document: boardDocumentSchema,
  viewport: viewportSchema,
});

export const boardRecordSchema = saveBoardInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BoardDocument = z.infer<typeof boardDocumentSchema>;
export type BoardRecord = z.infer<typeof boardRecordSchema>;
export type NoteColor = z.infer<typeof noteColorSchema>;
export type Point = z.infer<typeof pointSchema>;
export type SaveBoardInput = z.infer<typeof saveBoardInputSchema>;
export type StickyNote = z.infer<typeof stickyNoteSchema>;
export type Viewport = z.infer<typeof viewportSchema>;
