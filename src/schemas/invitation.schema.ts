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
