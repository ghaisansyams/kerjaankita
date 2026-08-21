"use server";

import { revalidatePath } from "next/cache";
import { requireInternal } from "@/lib/auth";
import * as repo from "@/repositories/meeting.repository";
import { transcribeAudio, transcriptionConfigured } from "@/services/ai/transcribe";
import {
  createMeetingSchema,
  meetingIdSchema,
  requestMeetingUploadSchema,
  saveTranscriptSchema,
} from "@/schemas/meeting.schema";
import { toFieldErrors } from "@/lib/validation";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";

const BUCKET = "meeting-recordings";

/** Whether Speech-to-Text is operational (provider key present). */
export async function meetingSttStatus(): Promise<ActionResult<{ enabled: boolean }>> {
  await requireInternal();
  return actionOk({ enabled: transcriptionConfigured() });
}

/** Authorize the audio upload; returns a tenant-scoped storage path. */
export async function requestMeetingUpload(
  input: unknown,
): Promise<ActionResult<{ bucket: string; path: string }>> {
  const ctx = await requireInternal();
  const parsed = requestMeetingUploadSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "That file can't be uploaded.");
  const safe = parsed.data.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "audio";
  const path = `${ctx.organization.id}/${crypto.randomUUID()}-${safe}`;
  return actionOk({ bucket: BUCKET, path });
}

export async function uploadAndCreateMeeting(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireInternal();
  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) || "").trim();
  const meetingDate = formData.get("meetingDate") as string | null;
  const durationSecondsRaw = formData.get("durationSeconds") as string | null;
  const isPrivate = formData.get("isPrivate") === "true";
  const projectId = formData.get("projectId") as string | null;
  const workspaceId = formData.get("workspaceId") as string | null;

  if (!title) {
    return actionError("VALIDATION", "Judul rapat wajib diisi.");
  }
  if (!file || !(file instanceof File) || file.size === 0) {
    return actionError("VALIDATION", "File audio rekaman wajib diunggah.");
  }

  const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
  if (file.size > MAX_SIZE) {
    return actionError("VALIDATION", "Ukuran file terlalu besar (maksimal 200 MB).");
  }

  try {
    const { promises: fs } = await import("fs");
    const pathModule = await import("path");

    const uploadDir = pathModule.join(process.cwd(), "public", "uploads", "meetings", ctx.organization.id);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "audio.mp3";
    const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const targetFilePath = pathModule.join(uploadDir, uniqueFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetFilePath, buffer);

    const audioPath = `/uploads/meetings/${ctx.organization.id}/${uniqueFileName}`;
    const durationSeconds = durationSecondsRaw ? parseInt(durationSecondsRaw, 10) : null;

    const id = await repo.insertMeetingRecord({
      organization_id: ctx.organization.id,
      workspace_id: workspaceId || null,
      project_id: projectId || null,
      title,
      meeting_date: meetingDate || null,
      audio_bucket: BUCKET,
      audio_path: audioPath,
      audio_file_name: file.name,
      audio_mime_type: file.type || "audio/mpeg",
      audio_size_bytes: file.size,
      duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      status: "uploaded",
      is_private: isPrivate,
      created_by: ctx.profile.id,
      updated_by: ctx.profile.id,
    });

    revalidatePath("/meetings");
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function createMeeting(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireInternal();
  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const d = parsed.data;
  if (!d.path.startsWith(`${ctx.organization.id}/`) && !d.path.startsWith(`/uploads/`)) return actionError("FORBIDDEN", "Invalid file path.");
  try {
    const id = await repo.insertMeetingRecord({
      organization_id: ctx.organization.id,
      workspace_id: d.workspaceId ?? null,
      project_id: d.projectId ?? null,
      title: d.title,
      meeting_date: d.meetingDate || null,
      audio_bucket: BUCKET,
      audio_path: d.path,
      audio_file_name: d.fileName,
      audio_mime_type: d.fileType || null,
      audio_size_bytes: d.fileSize,
      duration_seconds: d.durationSeconds ?? null,
      status: "uploaded",
      is_private: d.isPrivate ?? false,
      created_by: ctx.profile.id,
      updated_by: ctx.profile.id,
    });
    revalidatePath("/meetings");
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

/** Transcribe the recording via Speech-to-Text with Groq Whisper. */
export async function transcribeMeeting(input: unknown): Promise<ActionResult<{ transcript: string }>> {
  const ctx = await requireInternal();
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { id } = parsed.data;

  const meeting = await repo.getMeetingRecord(id);
  if (!meeting) return actionError("NOT_FOUND", "Meeting not found.");
  if (!meeting.audio_path) return actionError("VALIDATION", "This meeting has no audio.");
  if (!transcriptionConfigured()) {
    return actionError(
      "NOT_CONFIGURED",
      "Speech-to-Text belum dikonfigurasi. Tambahkan GROQ_API_KEY di .env.local untuk mengaktifkan transkrip cepat dengan Groq Whisper AI.",
    );
  }

  try {
    await repo.adminUpdateMeeting(id, { status: "transcribing", error: null });
    const audio = await repo.adminDownloadAudio(meeting.audio_bucket as string, meeting.audio_path as string);
    const result = await transcribeAudio({
      data: audio,
      fileName: (meeting.audio_file_name as string) || "audio.mp3",
      mimeType: (meeting.audio_mime_type as string) || undefined,
    });
    await repo.adminUpsertTranscript({
      organization_id: meeting.organization_id,
      meeting_id: id,
      content: result.text,
      raw_content: result.text,
      provider: result.provider || "groq",
      model: result.model || "whisper-large-v3-turbo",
      language: result.language ?? null,
      updated_by: ctx.profile.id,
      updated_at: new Date().toISOString(),
    });
    await repo.adminUpdateMeeting(id, { status: "transcribed", error: null });
    revalidatePath(`/meetings/${id}`);
    return actionOk({ transcript: result.text });
  } catch (e) {
    await repo.adminUpdateMeeting(id, {
      status: "failed",
      error: (e as Error)?.message?.slice(0, 500) ?? "error",
    });
    return mapUnknownError(e);
  }
}

/** Short-lived signed URL for the audio player. */
export async function getMeetingAudioUrl(input: unknown): Promise<ActionResult<{ url: string | null }>> {
  await requireInternal();
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const meeting = await repo.getMeetingRecord(parsed.data.id);
  if (!meeting || !meeting.audio_path) return actionError("NOT_FOUND", "Audio not found.");
  const url = await repo.adminSignedAudioUrl(
    meeting.audio_bucket as string,
    meeting.audio_path as string,
    3600,
  );
  return actionOk({ url });
}

/** Auto-save the edited transcript. */
export async function saveTranscript(input: unknown): Promise<ActionResult> {
  const ctx = await requireInternal();
  const parsed = saveTranscriptSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  try {
    await repo.saveTranscriptContent(parsed.data.meetingId, parsed.data.content, ctx.profile.id);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteMeeting(input: unknown): Promise<ActionResult> {
  const ctx = await requireInternal();
  const parsed = meetingIdSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  try {
    const removed = await repo.softDeleteMeeting(parsed.data.id, ctx.profile.id);
    if (!removed) return actionError("FORBIDDEN", "You can't delete this meeting.");
    revalidatePath("/meetings");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
