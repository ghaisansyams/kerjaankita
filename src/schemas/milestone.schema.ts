import { z } from "zod";

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

export const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optional(z.string().max(2000)),
  dueDate: optional(z.string()),
});

export const updateMilestoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  description: optional(z.string().max(2000)),
  dueDate: optional(z.string()),
  achieved: z.boolean().optional(),
});

export const deleteMilestoneSchema = z.object({ id: z.string().uuid() });

export const reorderMilestonesSchema = z.object({
  projectId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

/** Client form schema (all strings). */
export const milestoneFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(2000),
  dueDate: z.string(),
});

export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;
