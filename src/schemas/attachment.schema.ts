import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 52_428_800; // 50 MB (matches the bucket)

export const ALLOWED_ATTACHMENT_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "application/json",
] as const;

export const requestUploadSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().refine((t) => ALLOWED_ATTACHMENT_MIME.includes(t as never), {
    message: "That file type isn't allowed.",
  }),
  fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES, "File is too large (max 50 MB)."),
});

export const registerAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  path: z.string().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().max(255),
  fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export const attachmentIdSchema = z.object({ id: z.string().uuid() });

/**
 * Same target, two intents. Omitted/false yields a URL the browser renders
 * inline (previewing); true adds Content-Disposition so it saves to disk.
 * Authorization is identical either way — the flag only picks the header.
 */
export const attachmentUrlSchema = attachmentIdSchema.extend({
  download: z.boolean().optional(),
});

export const shareAttachmentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  shared: z.boolean(),
});
