import { z } from "zod";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === "none" ? undefined : v),
  z.string().uuid().optional(),
);

export const createInvitationSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(200),
    roleId: z.string().uuid(),
    workspaceId: optionalUuid,
    memberType: z.enum(["member", "guest"]),
    accountId: optionalUuid,
  })
  .refine((d) => d.memberType !== "guest" || !!d.accountId, {
    message: "Choose the client account this guest belongs to",
    path: ["accountId"],
  });

export const revokeInvitationSchema = z.object({ id: z.string().uuid() });

export const acceptInvitationSchema = z.object({ token: z.string().min(10).max(200) });

/**
 * Creating a workspace account outright, instead of mailing a link the person
 * has to redeem. Same target as an invitation, plus the credentials.
 */
export const createMemberAccountSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(200),
    fullName: z.string().trim().min(1, "Name is required").max(120),
    password: z.string().min(8, "At least 8 characters").max(72),
    roleId: z.string().uuid("Choose a role"),
    memberType: z.enum(["member", "guest"]),
    accountId: optionalUuid,
  })
  .refine((d) => d.memberType !== "guest" || !!d.accountId, {
    message: "Choose the client account this guest belongs to",
    path: ["accountId"],
  });
