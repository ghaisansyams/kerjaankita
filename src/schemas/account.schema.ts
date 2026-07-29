import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalEmail = z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal(""));

export const accountFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  code: optionalText(20),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalText(200),
  address: optionalText(300),
  notes: optionalText(2000),
};

export const createAccountSchema = z.object(accountFields);
export const updateAccountSchema = z.object({ id: z.string().uuid(), ...accountFields });
export const deleteAccountSchema = z.object({ id: z.string().uuid() });

export const inviteContactSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().trim().email("Enter a valid email").max(200),
});
