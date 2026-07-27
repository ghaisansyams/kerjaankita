import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Give your organization a name").max(80),
  industryKey: z.string().min(1, "Choose an industry"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
