import { z } from "zod";

export const addChecklistItemSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().trim().min(1, "Add some text").max(500),
});

export const toggleChecklistItemSchema = z.object({
  id: z.string().uuid(),
  isDone: z.boolean(),
});

export const updateChecklistItemSchema = z.object({
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
});

export const deleteChecklistItemSchema = z.object({ id: z.string().uuid() });

export const reorderChecklistSchema = z.object({
  taskId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});
