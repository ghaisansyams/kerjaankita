import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color");
const columnName = z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters");
const weight = z.number().int().min(0).max(100);

export const createColumnSchema = z.object({
  projectId: z.string().uuid(),
  workflowId: z.string().uuid(),
  name: columnName,
  color: hexColor.default("#64748B"),
  weight: weight.default(0),
});

export const updateColumnSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid(),
  name: columnName.optional(),
  color: hexColor.optional(),
  weight: weight.optional(),
});

export const reorderColumnsSchema = z.object({
  projectId: z.string().uuid(),
  workflowId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

export const deleteColumnSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid(),
  reassignTo: z.string().uuid().nullable().default(null),
});

export const setDefaultColumnSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid(),
});

export const setCompletedColumnSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid(),
  completed: z.boolean(),
});
