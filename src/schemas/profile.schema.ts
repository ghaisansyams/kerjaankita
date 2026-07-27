import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(120),
  title: z.string().trim().max(120),
  timezone: z.string().min(1).max(64),
  locale: z.string().min(1).max(10),
  dateFormat: z.string().min(1).max(20),
});
export type ProfileFormValues = z.infer<typeof updateProfileSchema>;

export const updateAvatarSchema = z.object({ avatarUrl: z.string().url().max(1000) });

export const updateEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(200),
});
export type EmailFormValues = z.infer<typeof updateEmailSchema>;

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
export type PasswordFormValues = z.infer<typeof changePasswordSchema>;
