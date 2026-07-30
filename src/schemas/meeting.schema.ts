import { z } from "zod";

export const MEETING_AUDIO_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
] as const;

export const requestMeetingUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().max(255).optional().default(""),
});

export const createMeetingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  path: z.string().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().max(255).optional().default(""),
  fileSize: z.number().int().positive().max(209_715_200),
  durationSeconds: z.number().int().nonnegative().max(86_400).optional(),
  projectId: z.string().uuid().nullable().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  meetingDate: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
});

export const meetingIdSchema = z.object({ id: z.string().uuid() });

export const saveTranscriptSchema = z.object({
  meetingId: z.string().uuid(),
  content: z.string().max(500_000),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
