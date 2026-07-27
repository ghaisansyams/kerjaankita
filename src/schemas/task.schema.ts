import { z } from "zod";

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null || v === "none" ? undefined : v), schema.optional());

/* -------------------------------------------------------------------------- */
/*  Server (authoritative) schemas                                            */
/* -------------------------------------------------------------------------- */

export const createTaskSchema = z
  .object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: optional(z.string().max(10000)),
    priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
    assigneeId: optional(z.string().uuid()),
    statusId: optional(z.string().uuid()),
    startDate: optional(z.string()),
    dueDate: optional(z.string()),
    estimatedHours: optional(z.coerce.number().min(0).max(100000)),
  })
  .refine((d) => !d.startDate || !d.dueDate || d.startDate <= d.dueDate, {
    message: "Due date must be on or after the start date",
    path: ["dueDate"],
  });

export const updateTaskSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    description: optional(z.string().max(10000)),
    priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
    assigneeId: optional(z.string().uuid()),
    startDate: optional(z.string()),
    dueDate: optional(z.string()),
    estimatedHours: optional(z.coerce.number().min(0).max(100000)),
    actualHours: optional(z.coerce.number().min(0).max(100000)),
    githubPrUrl: optional(z.string().url().max(500)),
    figmaUrl: optional(z.string().url().max(500)),
    stagingUrl: optional(z.string().url().max(500)),
    productionUrl: optional(z.string().url().max(500)),
    evidenceNotes: optional(z.string().max(5000)),
  })
  .refine((d) => !d.startDate || !d.dueDate || d.startDate <= d.dueDate, {
    message: "Due date must be on or after the start date",
    path: ["dueDate"],
  });

export const updateTaskStatusSchema = z.object({
  id: z.string().uuid(),
  statusId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});

export const updateTaskProgressSchema = z.object({
  id: z.string().uuid(),
  progress: z
    .number()
    .int()
    .min(0)
    .max(100)
    .refine((n) => n % 10 === 0, "Progress must be in steps of 10"),
});

export const deleteTaskSchema = z.object({ id: z.string().uuid() });

/** Kanban move: change column (status) and/or reorder (fractional position). */
export const moveTaskSchema = z.object({
  id: z.string().uuid(),
  statusId: z.string().uuid(),
  position: z.number().finite(),
});

/** Calendar drag-to-reschedule: set (or clear) the due date. */
export const rescheduleTaskSchema = z.object({
  id: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date").nullable(),
});

/* -------------------------------------------------------------------------- */
/*  Client form schemas (all strings; "none" = unset select)                  */
/* -------------------------------------------------------------------------- */

export const PRIORITIES_TUPLE = ["none", "low", "medium", "high", "critical"] as const;

export const createTaskFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(10000),
  priority: z.enum(PRIORITIES_TUPLE),
  assigneeId: z.string(),
  startDate: z.string(),
  dueDate: z.string(),
  estimatedHours: z.string(),
});
export type CreateTaskFormValues = z.infer<typeof createTaskFormSchema>;

export const editTaskFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(10000),
  priority: z.enum(PRIORITIES_TUPLE),
  assigneeId: z.string(),
  startDate: z.string(),
  dueDate: z.string(),
  estimatedHours: z.string(),
  actualHours: z.string(),
  githubPrUrl: z.string(),
  figmaUrl: z.string(),
  stagingUrl: z.string(),
  productionUrl: z.string(),
  evidenceNotes: z.string(),
});
export type EditTaskFormValues = z.infer<typeof editTaskFormSchema>;
