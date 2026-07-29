import { z } from "zod";

/** A screenshot already uploaded to storage during the parse step. */
export const importImageSchema = z.object({
  path: z.string().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
});

export const requestImportUploadSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().max(255).optional().default(""),
});

export const parseImportSchema = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
});

export const commitImportSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid().nullable().optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(5000).optional(),
        images: z.array(importImageSchema).max(8).default([]),
      }),
    )
    .min(1)
    .max(100),
});

export type CommitImportInput = z.infer<typeof commitImportSchema>;
