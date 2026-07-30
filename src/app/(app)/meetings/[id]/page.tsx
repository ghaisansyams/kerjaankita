import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth";
import {
  adminSignedAudioUrl,
  getMeetingRecord,
  getTranscript,
} from "@/repositories/meeting.repository";
import { transcriptionConfigured } from "@/services/ai/transcribe";
import { MeetingDetail } from "@/features/meetings/components/meeting-detail";

export const metadata = { title: "Meeting — AI Meeting Assistant" };

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireInternal();

  // RLS: getMeetingRecord returns null unless the caller may view this meeting.
  const meeting = await getMeetingRecord(id);
  if (!meeting) notFound();

  const transcript = await getTranscript(id);
  const audioUrl = meeting.audio_path
    ? await adminSignedAudioUrl(meeting.audio_bucket as string, meeting.audio_path as string, 3600)
    : null;

  return (
    <MeetingDetail
      meeting={{
        id: meeting.id as string,
        title: meeting.title as string,
        status: (meeting.status as string) ?? "uploaded",
        fileName: (meeting.audio_file_name as string | null) ?? null,
        sizeBytes: meeting.audio_size_bytes != null ? Number(meeting.audio_size_bytes) : null,
        durationSeconds: meeting.duration_seconds != null ? Number(meeting.duration_seconds) : null,
        error: (meeting.error as string | null) ?? null,
      }}
      transcript={(transcript?.content as string) ?? ""}
      audioUrl={audioUrl}
      sttEnabled={transcriptionConfigured()}
    />
  );
}
