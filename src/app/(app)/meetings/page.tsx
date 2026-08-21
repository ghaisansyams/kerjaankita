import { requireInternal } from "@/lib/auth";
import { listMeetingRecords } from "@/repositories/meeting.repository";
import { transcriptionConfigured } from "@/services/ai/transcribe";
import { MeetingsView, type MeetingVM } from "@/features/meetings/components/meetings-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Meeting Assistant" };

export default async function MeetingsPage() {
  const ctx = await requireInternal();
  const rows = await listMeetingRecords(ctx.organization.id);
  const meetings: MeetingVM[] = rows.map((m) => ({
    id: m.id as string,
    title: m.title as string,
    status: (m.status as string) ?? "uploaded",
    meetingDate: (m.meeting_date as string | null) ?? null,
    durationSeconds: m.duration_seconds != null ? Number(m.duration_seconds) : null,
    sizeBytes: m.audio_size_bytes != null ? Number(m.audio_size_bytes) : null,
    fileName: (m.audio_file_name as string | null) ?? null,
    isPrivate: Boolean(m.is_private),
    createdAt: m.created_at as string,
  }));
  return <MeetingsView meetings={meetings} sttEnabled={transcriptionConfigured()} />;
}
