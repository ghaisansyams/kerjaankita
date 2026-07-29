"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createMom, updateMom } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { v: "discussion", l: "Discussion" },
  { v: "decision", l: "Decision" },
  { v: "action_item", l: "Action item" },
  { v: "next_step", l: "Next step" },
];
const NONE = "__none__";

type Participant = { name: string; role: string; company: string };
type Note = { id?: string; category: string; content: string };
export type MomFormInitial = {
  projectId?: string;
  title?: string;
  meetingDate?: string;
  meetingTime?: string | null;
  location?: string | null;
  picId?: string | null;
  approvedByName?: string;
  approvedByRole?: string;
  participants?: Participant[];
  distribution?: string[];
  notes?: Note[];
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-rose-500"> *</span>}</Label>
      {children}
    </div>
  );
}

export function MomForm({
  mode,
  momId,
  projects,
  members,
  initial,
}: {
  mode: "create" | "edit";
  momId?: string;
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
  initial?: MomFormInitial;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meetingDate, setMeetingDate] = useState(initial?.meetingDate ?? "");
  const [meetingTime, setMeetingTime] = useState(initial?.meetingTime ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [picId, setPicId] = useState(initial?.picId ?? "");
  const [approvedByName, setApprovedByName] = useState(initial?.approvedByName ?? "Galih Aldio Putra");
  const [approvedByRole, setApprovedByRole] = useState(initial?.approvedByRole ?? "Director");
  const [participants, setParticipants] = useState<Participant[]>(initial?.participants ?? []);
  const [distribution, setDistribution] = useState<string[]>(initial?.distribution ?? []);
  const [notes, setNotes] = useState<Note[]>(initial?.notes?.length ? initial.notes : [{ category: "discussion", content: "" }]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!projectId) return toast.error("Select a project");
    if (title.trim().length < 2) return toast.error("Meeting title is required");
    if (!meetingDate) return toast.error("Meeting date is required");

    const payload = {
      ...(mode === "edit" ? { id: momId } : {}),
      projectId,
      title,
      meetingDate,
      meetingTime,
      location,
      picId: picId || "",
      approvedByName,
      approvedByRole,
      participants: participants.filter((p) => p.name.trim()),
      distribution: distribution.filter((d) => d.trim()),
      notes: notes.filter((n) => n.content.trim()).map((n) => ({ ...(n.id ? { id: n.id } : {}), category: n.category, content: n.content })),
    };
    setBusy(true);
    if (mode === "edit") {
      const res = await updateMom(payload);
      setBusy(false);
      if (!res?.ok) return toast.error(res?.error.message ?? "Couldn't save the MOM.");
      toast.success("MOM updated");
      router.push(`/mom/${momId}`);
    } else {
      const res = await createMom(payload);
      setBusy(false);
      if (!res?.ok) return toast.error(res?.error.message ?? "Couldn't save the MOM.");
      toast.success("MOM created");
      router.push(`/mom/${res.data.id}`);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="max-w-3xl space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">Meeting details</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project" required>
              <Select value={projectId} onValueChange={setProjectId} disabled={mode === "edit"}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="PIC (person in charge)">
              <Select value={picId || NONE} onValueChange={(v) => setPicId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Meeting title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kick-off meeting" maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" required><Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /></Field>
            <Field label="Time"><Input value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} placeholder="14:00 – 15:30" /></Field>
            <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Meeting Room / Zoom" /></Field>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Participants</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setParticipants([...participants, { name: "", role: "", company: "" }])}>
            <Plus className="size-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {participants.length === 0 && <p className="text-sm text-muted-foreground">No participants added.</p>}
          {participants.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <Input value={p.name} placeholder="Name" onChange={(e) => setParticipants(participants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input value={p.role} placeholder="Role" onChange={(e) => setParticipants(participants.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
              <Input value={p.company} placeholder="Company" onChange={(e) => setParticipants(participants.map((x, j) => (j === i ? { ...x, company: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setParticipants(participants.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Distribution */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Distribution</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setDistribution([...distribution, ""])}><Plus className="size-4" /> Add</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {distribution.length === 0 && <p className="text-sm text-muted-foreground">No recipients added.</p>}
          {distribution.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={d} placeholder="e.g. Client, Internal Team, Management" onChange={(e) => setDistribution(distribution.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setDistribution(distribution.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Meeting notes — structured numbered points */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Meeting notes</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setNotes([...notes, { category: "discussion", content: "" }])}><Plus className="size-4" /> Add point</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.map((n, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={n.category} onValueChange={(v) => setNotes(notes.map((x, j) => (j === i ? { ...x, category: v } : x)))}>
                    <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="ml-auto" aria-label="Remove point" onClick={() => setNotes(notes.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </div>
                <Textarea rows={2} value={n.content} placeholder="Write the point…" onChange={(e) => setNotes(notes.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Approval */}
      <Card>
        <CardHeader><CardTitle className="text-base">Approval</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Approved by (name)"><Input value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} /></Field>
          <Field label="Approved by (role)"><Input value={approvedByRole} onChange={(e) => setApprovedByRole(e.target.value)} /></Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{mode === "edit" ? "Save changes" : "Create MOM"}</Button>
      </div>
    </form>
  );
}
