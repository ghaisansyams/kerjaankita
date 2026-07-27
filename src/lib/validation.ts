import type { z } from "zod";

/** Flatten a ZodError into `{ field: [messages] }` for the action envelope. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}
