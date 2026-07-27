import { z } from "zod";

export const markNotificationReadSchema = z.object({ id: z.string().uuid() });

export const setNotificationPreferenceSchema = z.object({
  type: z.string().min(1).max(64),
  inApp: z.boolean(),
  email: z.boolean().optional(),
});
