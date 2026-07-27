import { z } from "zod";

export const addProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid("Select a person"),
  roleId: z.string().uuid("Select a role"),
  allocationPct: z.number().int().min(0).max(100).optional(),
});

export const changeProjectMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  roleId: z.string().uuid("Select a role"),
});

export const removeProjectMemberSchema = z.object({
  memberId: z.string().uuid(),
});

/** Client form schema for the add-member dialog (Select values are strings). */
export const addMemberFormSchema = z.object({
  userId: z.string().min(1, "Select a person"),
  roleId: z.string().min(1, "Select a role"),
});

export type AddMemberFormValues = z.infer<typeof addMemberFormSchema>;
