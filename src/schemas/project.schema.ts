import { z } from "zod";

/** Coerce empty form values ("" / null / "none" sentinel) to undefined. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === "none" ? undefined : v),
    schema.optional(),
  );

export const PROJECT_VISIBILITIES = [
  "organization",
  "workspace",
  "private",
] as const;

const projectFields = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  workspaceId: z.string().uuid("Select a workspace"),
  accountId: optional(z.string().uuid()),
  ownerId: optional(z.string().uuid()),
  visibility: z.enum(PROJECT_VISIBILITIES),
  color: z.string().min(1),
  key: optional(
    z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{2,6}$/, "2–6 uppercase letters or numbers"),
  ),
  description: optional(z.string().max(5000)),
  startDate: optional(z.string()),
  endDate: optional(z.string()),
});

const datesInOrder = (d: { startDate?: string; endDate?: string }) =>
  !d.startDate || !d.endDate || d.startDate <= d.endDate;
const dateError = {
  message: "End date must be on or after the start date",
  path: ["endDate"] as string[],
};

export const createProjectSchema = projectFields.refine(datesInOrder, dateError);

export const updateProjectSchema = projectFields
  .partial()
  .extend({ id: z.string().uuid() })
  .refine(datesInOrder, dateError);

/**
 * Client-side form schema (all strings; "none" = unset select). Used by RHF +
 * zodResolver for UX validation. The strict server schemas above remain the
 * authoritative boundary — the form maps these values before calling the action.
 */
export const projectFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
    key: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{2,6}$/, "2–6 uppercase letters or numbers")
      .or(z.literal("")),
    workspaceId: z.string().min(1, "Select a workspace"),
    accountId: z.string(),
    ownerId: z.string(),
    visibility: z.enum(PROJECT_VISIBILITIES),
    color: z.string().min(1),
    description: z.string().max(5000),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine(datesInOrder, dateError);

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const deleteProjectSchema = z.object({
  id: z.string().uuid(),
  confirmName: z.string().min(1),
});

export const archiveProjectSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
