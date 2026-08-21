import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface InsertMeetingInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  title: string;
  description?: string | null;
  meeting_date?: string | null;
  meetingDate?: string | null;
  meeting_time?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  meeting_type?: string | null;
  meetingType?: string | null;
  audio_bucket?: string;
  audioBucket?: string;
  audio_path?: string | null;
  audioPath?: string | null;
  audio_file_name?: string | null;
  audioFileName?: string | null;
  audio_mime_type?: string | null;
  audioMimeType?: string | null;
  audio_size_bytes?: number | bigint | null;
  audioSizeBytes?: number | bigint | null;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  status?: string;
  is_private?: boolean;
  isPrivate?: boolean;
  created_by?: string | null;
  createdBy?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
}

export async function insertMeetingRecord(values: InsertMeetingInput): Promise<string> {
  const size = values.audioSizeBytes !== undefined ? values.audioSizeBytes : values.audio_size_bytes;
  const data = await prisma.meetingRecord.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      workspaceId: values.workspaceId !== undefined ? values.workspaceId : values.workspace_id,
      projectId: values.projectId !== undefined ? values.projectId : values.project_id,
      title: values.title,
      description: values.description,
      meetingDate: values.meetingDate ? new Date(values.meetingDate) : values.meeting_date ? new Date(values.meeting_date) : undefined,
      meetingTime: values.meetingTime || values.meeting_time,
      location: values.location,
      meetingType: values.meetingType || values.meeting_type,
      audioBucket: values.audioBucket || values.audio_bucket || "meeting-recordings",
      audioPath: values.audioPath || values.audio_path,
      audioFileName: values.audioFileName || values.audio_file_name,
      audioMimeType: values.audioMimeType || values.audio_mime_type,
      audioSizeBytes: size ? BigInt(size) : undefined,
      durationSeconds: values.durationSeconds !== undefined ? values.durationSeconds : values.duration_seconds,
      status: values.status || "uploaded",
      isPrivate: values.isPrivate ?? values.is_private ?? false,
      createdBy: values.createdBy || values.created_by,
      updatedBy: values.updatedBy || values.updated_by,
    },
    select: { id: true },
  });
  return data.id;
}

export async function listMeetingRecords(orgId: string) {
  const data = await prisma.meetingRecord.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      meetingDate: true,
      status: true,
      durationSeconds: true,
      audioSizeBytes: true,
      audioFileName: true,
      projectId: true,
      isPrivate: true,
      createdAt: true,
      createdBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    title: d.title,
    meeting_date: d.meetingDate ? d.meetingDate.toISOString().split("T")[0] : null,
    status: d.status,
    duration_seconds: d.durationSeconds,
    audio_size_bytes: d.audioSizeBytes ? Number(d.audioSizeBytes) : null,
    audio_file_name: d.audioFileName,
    project_id: d.projectId,
    is_private: d.isPrivate,
    created_at: d.createdAt.toISOString(),
    created_by: d.createdBy,
  }));
}

export async function getMeetingRecord(id: string) {
  const d = await prisma.meetingRecord.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      transcripts: true,
    },
  });

  if (!d) return null;

  const t = d.transcripts[0] ?? null;

  return {
    id: d.id,
    organization_id: d.organizationId,
    workspace_id: d.workspaceId,
    project_id: d.projectId,
    title: d.title,
    description: d.description,
    meeting_date: d.meetingDate ? d.meetingDate.toISOString().split("T")[0] : null,
    meeting_time: d.meetingTime,
    location: d.location,
    meeting_type: d.meetingType,
    audio_bucket: d.audioBucket,
    audio_path: d.audioPath,
    audio_file_name: d.audioFileName,
    audio_mime_type: d.audioMimeType,
    audio_size_bytes: d.audioSizeBytes ? Number(d.audioSizeBytes) : null,
    duration_seconds: d.durationSeconds,
    status: d.status,
    error: d.error,
    is_private: d.isPrivate,
    created_by: d.createdBy,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
    transcript: t ? {
      id: t.id,
      content: t.content,
      raw_content: t.rawContent,
      provider: t.provider,
      model: t.model,
      language: t.language,
      segments: t.segments,
      created_at: t.createdAt.toISOString(),
    } : null,
    mom: null,
  };
}

export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof getMeetingRecord>>>;
export type MeetingRow = MeetingDetail;

export interface UpdateMeetingInput {
  title?: string;
  description?: string | null;
  status?: string;
  error?: string | null;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  audio_path?: string | null;
  audioPath?: string | null;
  audio_file_name?: string | null;
  audioFileName?: string | null;
  audio_mime_type?: string | null;
  audioMimeType?: string | null;
  audio_size_bytes?: number | bigint | null;
  audioSizeBytes?: number | bigint | null;
}

export async function updateMeetingRecord(id: string, patch: UpdateMeetingInput) {
  const size = patch.audioSizeBytes !== undefined ? patch.audioSizeBytes : patch.audio_size_bytes;
  const data = await prisma.meetingRecord.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      status: patch.status,
      error: patch.error,
      durationSeconds: patch.durationSeconds !== undefined ? patch.durationSeconds : patch.duration_seconds,
      audioPath: patch.audioPath !== undefined ? patch.audioPath : patch.audio_path,
      audioFileName: patch.audioFileName !== undefined ? patch.audioFileName : patch.audio_file_name,
      audioMimeType: patch.audioMimeType !== undefined ? patch.audioMimeType : patch.audio_mime_type,
      audioSizeBytes: size ? BigInt(size) : undefined,
    },
    select: { id: true },
  });
  return data;
}

export async function softDeleteMeetingRecord(id: string, deletedBy: string) {
  const data = await prisma.meetingRecord.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy,
    },
    select: { id: true },
  });
  return data;
}

export const softDeleteMeeting = softDeleteMeetingRecord;

export async function getTranscript(meetingId: string) {
  const d = await prisma.meetingTranscript.findUnique({
    where: { meetingId },
  });
  if (!d) return null;
  return {
    id: d.id,
    meeting_id: d.meetingId,
    content: d.content,
    raw_content: d.rawContent,
    provider: d.provider,
    model: d.model,
    language: d.language,
    segments: d.segments,
    created_at: d.createdAt.toISOString(),
  };
}

export async function saveTranscriptContent(meetingId: string, content: string, updatedBy?: string) {
  const meeting = await prisma.meetingRecord.findUnique({
    where: { id: meetingId },
    select: { organizationId: true },
  });
  if (!meeting) return null;

  return await prisma.meetingTranscript.upsert({
    where: { meetingId },
    update: { content },
    create: {
      meetingId,
      organizationId: meeting.organizationId,
      content,
      updatedBy,
    },
  });
}

// ----- pipeline -------------------------------------------------------------
export async function adminGetMeeting(id: string): Promise<MeetingRow | null> {
  return getMeetingRecord(id);
}

export async function adminUpdateMeeting(id: string, patch: UpdateMeetingInput) {
  return updateMeetingRecord(id, patch);
}

export interface UpsertTranscriptInput {
  id?: string;
  meeting_id?: string;
  meetingId?: string;
  organization_id?: string;
  organizationId?: string;
  content?: string;
  raw_content?: string | null;
  rawContent?: string | null;
  provider?: string | null;
  model?: string | null;
  language?: string | null;
  segments?: Prisma.InputJsonValue;
  updated_by?: string;
  updatedBy?: string;
  updated_at?: string;
  updatedAt?: string;
}

export async function adminUpsertTranscript(values: UpsertTranscriptInput) {
  const meetingId = (values.meetingId || values.meeting_id)!;
  const organizationId = (values.organizationId || values.organization_id)!;
  await prisma.meetingTranscript.upsert({
    where: { meetingId },
    update: {
      content: values.content || "",
      rawContent: values.rawContent !== undefined ? values.rawContent : values.raw_content,
      provider: values.provider,
      model: values.model,
      language: values.language,
      segments: values.segments,
      updatedBy: values.updatedBy || values.updated_by,
    },
    create: {
      id: values.id,
      meetingId,
      organizationId,
      content: values.content || "",
      rawContent: values.rawContent !== undefined ? values.rawContent : values.raw_content,
      provider: values.provider,
      model: values.model,
      language: values.language,
      segments: values.segments,
      updatedBy: values.updatedBy || values.updated_by,
    },
  });
}

export async function adminSignedAudioUrl(bucket?: string, audioPath?: string, ttl = 3600): Promise<string | null> {
  void bucket;
  void ttl;
  if (!audioPath) return null;
  if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) return audioPath;
  if (audioPath.startsWith("/")) return audioPath;
  return `/${audioPath}`;
}

export async function adminDownloadAudio(bucket?: string, audioPath?: string): Promise<Buffer> {
  void bucket;
  if (!audioPath) throw new Error("Audio path is missing");

  if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) {
    const res = await fetch(audioPath);
    if (!res.ok) throw new Error(`Failed to fetch audio from URL: ${res.statusText}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  const { promises: fs } = await import("fs");
  const pathModule = await import("path");
  const cleanPath = audioPath.replace(/^\/+/, "");

  const publicPath = pathModule.join(process.cwd(), "public", cleanPath);
  try {
    return await fs.readFile(publicPath);
  } catch {
    const rootPath = pathModule.join(process.cwd(), cleanPath);
    return await fs.readFile(rootPath);
  }
}
