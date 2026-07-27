import { z } from "zod";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === "none" ? undefined : v),
  z.string().uuid().optional(),
);

/** Server (authoritative) schema. */
export const updateWorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour"),
  defaultWorkflowId: optionalUuid,
});

/** Client form schema (all strings; `defaultWorkflowId` may be "none"). */
export const workspaceFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4F46E5"),
  defaultWorkflowId: z.string(),
});
export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

export const updateWorkspaceLogoSchema = z.object({
  id: z.string().uuid(),
  logoUrl: z.string().url().max(1000),
});

export const archiveWorkspaceSchema = z.object({ id: z.string().uuid() });
