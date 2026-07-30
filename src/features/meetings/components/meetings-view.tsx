"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileAudio, Loader2, Mic, Plus, Search, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createMeeting, requestMeetingUpload } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/utils/format";

export type MeetingVM = {
  id: string;
  title: string;
  status: string;
  meetingDate: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  fileName: string | null;
  isPrivate: boolean;
  createdAt: string;
};

const ACCEPT = ".mp3,.wav,.m4a,.aac,.ogg,.opus,.webm,audio/*";
const MAX_BYTES = 200 * 1024 * 1024;

function fmtBytes(n: number | null) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let v = n,
    i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      a.src = url;
    } catch {
      resolve(0);
    }
  });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "Uploaded", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  transcribing: { label: "Transcribing", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  transcribed: { label: "Transcribed", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};

export function MeetingsView({ meetings, sttEnabled }: { meetings: MeetingVM[]; sttEnabled: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter(
      (m) => m.title.toLowerCase().includes(q) || (m.fileName ?? "").toLowerCase().includes(q),
    );
  }, [meetings, search]);

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("File terlalu besar (maks 200 MB).");
      return;
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  async function submit() {
    if (!title.trim() || !file) return;
    setUploading(true);
    try {
      const durationSeconds = await readDuration(file);
      const req = await requestMeetingUpload({ fileName: file.name, fileType: file.type });
      if (!req?.ok) {
        toast.error(req?.error.message ?? "Gagal menyiapkan upload.");
        return;
      }
      const supabase = createClient();
      const up = await supabase.storage
        .from(req.data.bucket)
        .upload(req.data.path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) {
        toast.error("Gagal mengunggah audio.");
        return;
      }
      const res = await createMeeting({
        title: title.trim(),
        path: req.data.path,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        durationSeconds,
      });
      if (!res?.ok) {
        toast.error(res?.error.message ?? "Gagal menyimpan rekaman.");
        return;
      }
      toast.success("Rekaman diunggah");
      router.push(`/meetings/${res.data.id}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <Mic className="size-6 text-primary" /> AI Meeting Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Unggah rekaman rapat → transkrip otomatis. (Ringkasan, MoM, dan action item menyusul.)
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Rekaman baru
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari judul / file…"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <FileAudio className="size-8" />
            {meetings.length === 0 ? "Belum ada rekaman. Klik “Rekaman baru”." : "Tidak ada yang cocok."}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const st = STATUS[m.status] ?? STATUS.uploaded;
            return (
              <li key={m.id}>
                <Link href={`/meetings/${m.id}`}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="space-y-2 pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 font-medium">{m.title}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{fmtDuration(m.durationSeconds)}</span>
                        <span>{fmtBytes(m.sizeBytes)}</span>
                        {m.meetingDate && <span>{formatDate(m.meetingDate)}</span>}
                        {m.isPrivate && <span className="text-amber-600 dark:text-amber-400">Private</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => !uploading && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rekaman baru</DialogTitle>
            <DialogDescription>
              Unggah audio rapat (MP3, WAV, M4A, AAC, OGG). Maks 200 MB.
              {!sttEnabled && " Transkrip otomatis aktif setelah API key STT dipasang."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Judul rapat</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rapat dengan klien…" />
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center rounded-lg border border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <UploadCloud className="mb-2 size-7 text-muted-foreground" />
              <span className="text-sm font-medium">{file ? file.name : "Pilih file audio"}</span>
              {file && <span className="mt-0.5 text-xs text-muted-foreground">{fmtBytes(file.size)}</span>}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading}>
              Batal
            </Button>
            <Button onClick={submit} disabled={uploading || !title.trim() || !file}>
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Mengunggah…
                </>
              ) : (
                "Unggah"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
