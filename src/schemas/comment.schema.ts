import { z } from "zod";

export const addCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something").max(5000),
});

export const editCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

export const deleteCommentSchema = z.object({ id: z.string().uuid() });
