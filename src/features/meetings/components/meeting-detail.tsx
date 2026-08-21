"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { deleteMeeting, saveTranscript, transcribeMeeting } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Meeting = {
  id: string;
  title: string;
  status: string;
  fileName: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  error: string | null;
};

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

export function MeetingDetail({
  meeting,
  transcript,
  audioUrl,
  sttEnabled,
}: {
  meeting: Meeting;
  transcript: string;
  audioUrl: string | null;
  sttEnabled: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(meeting.status);
  const [content, setContent] = useState(transcript);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(transcript);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasTranscript = content.trim().length > 0 || status === "transcribed";

  // Debounced auto-save of the edited transcript.
  const scheduleSave = useCallback(
    (value: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (value === savedRef.current) return;
        setSaveState("saving");
        const res = await saveTranscript({ meetingId: meeting.id, content: value });
        if (res?.ok) {
          savedRef.current = value;
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 1500);
        } else {
          setSaveState("idle");
        }
      }, 1200);
    },
    [meeting.id],
  );
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function runTranscribe() {
    setBusy(true);
    setStatus("transcribing");
    const res = await transcribeMeeting({ id: meeting.id });
    setBusy(false);
    if (!res?.ok) {
      setStatus(meeting.status === "transcribed" ? "transcribed" : "uploaded");
      toast.error(res?.error.message ?? "Transkrip gagal.");
      return;
    }
    setContent(res.data.transcript);
    savedRef.current = res.data.transcript;
    setStatus("transcribed");
    toast.success("Transkrip selesai");
    router.refresh();
  }

  function findNext() {
    const ta = taRef.current;
    if (!ta || !search) return;
    const from = ta.selectionEnd || 0;
    const hay = content.toLowerCase();
    const needle = search.toLowerCase();
    let idx = hay.indexOf(needle, from);
    if (idx === -1) idx = hay.indexOf(needle, 0);
    if (idx === -1) {
      toast.info("Tidak ditemukan.");
      return;
    }
    ta.focus();
    ta.setSelectionRange(idx, idx + search.length);
  }

  function copyAll() {
    navigator.clipboard.writeText(content).then(
      () => toast.success("Transkrip disalin"),
      () => toast.error("Gagal menyalin"),
    );
  }
  function downloadTxt() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meeting.title.replace(/[^\w.\-]+/g, "_") || "transcript"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmDelete() {
    const res = await deleteMeeting({ id: meeting.id });
    if (!res?.ok) return toast.error(res?.error.message ?? "Gagal menghapus.");
    toast.success("Rekaman dihapus");
    router.push("/meetings");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/meetings" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> AI Meeting Assistant
          </Link>
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{meeting.title}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" /> Hapus
        </Button>
      </header>

      {/* Section 1 — Recording */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rekaman</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audioUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={audioUrl} className="w-full" />
          ) : (
            <p className="text-sm text-muted-foreground">Audio tidak tersedia.</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Durasi: {fmtDuration(meeting.durationSeconds)}</span>
            <span>Ukuran: {fmtBytes(meeting.sizeBytes)}</span>
            {meeting.fileName && <span className="truncate">File: {meeting.fileName}</span>}
            <span>Status: {status}</span>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Transcript */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Transkrip</CardTitle>
          {hasTranscript && (
            <span className="text-xs text-muted-foreground">
              {saveState === "saving" ? "Menyimpan…" : saveState === "saved" ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" /> Tersimpan
                </span>
              ) : "Auto-save aktif"}
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasTranscript ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Belum ada transkrip. Klik tombol di bawah untuk mengubah rekaman suara menjadi teks dengan Groq Whisper AI.
              </p>
              <Button onClick={runTranscribe} disabled={busy} className="gap-2">
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sedang Mentranskrip dengan Groq AI…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-amber-400" /> Transkrip dengan Groq AI
                  </>
                )}
              </Button>
              {!sttEnabled && (
                <div className="mt-2 max-w-md text-left rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400 mb-1">
                    <KeyRound className="size-3.5" /> Info Konfigurasi Groq AI
                  </div>
                  Pastikan <code>GROQ_API_KEY</code> sudah terpasang di <code>.env.local</code> server agar Speech-to-Text berjalan lancar.
                </div>
              )}
              {meeting.error && <p className="text-xs text-rose-600 dark:text-rose-400">{meeting.error}</p>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && findNext()}
                    placeholder="Cari di transkrip…"
                    className="h-8 pl-8"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={findNext} disabled={!search}>
                  Cari
                </Button>
                <Button variant="outline" size="sm" onClick={copyAll}>
                  <Copy className="size-4" /> Salin
                </Button>
                <Button variant="outline" size="sm" onClick={downloadTxt}>
                  <Download className="size-4" /> TXT
                </Button>
                {sttEnabled && (
                  <Button variant="outline" size="sm" onClick={runTranscribe} disabled={busy} className="gap-1.5 text-xs">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-amber-500" />}
                    Transkrip Ulang (Groq AI)
                  </Button>
                )}
              </div>
              <Textarea
                ref={taRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  scheduleSave(e.target.value);
                }}
                className="min-h-[420px] font-mono text-sm leading-relaxed"
                placeholder="Transkrip…"
              />
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus rekaman ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Rekaman dan transkripnya akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-rose-600 text-white hover:bg-rose-600/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
