"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, ImageOff, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  commitImportedTasks,
  parseImportDocument,
  requestImportUpload,
  type ImportPreviewTask,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = { id: string; name: string; color: string | null };
type Phase = "upload" | "parsing" | "review" | "committing";

const ACCEPT =
  ".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export function ImportTasksDialog({
  projectId,
  statuses,
  onDone,
}: {
  projectId: string;
  statuses: Status[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("upload");
  const [tasks, setTasks] = useState<ImportPreviewTask[]>([]);
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("upload");
    setTasks([]);
    setFileName("");
    setStatusId(statuses[0]?.id ?? "");
    if (inputRef.current) inputRef.current.value = "";
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function onFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      toast.error("Hanya file Word (.docx) atau PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File terlalu besar (maks 25 MB).");
      return;
    }
    setFileName(file.name);
    setPhase("parsing");
    try {
      const req = await requestImportUpload({ projectId, fileName: file.name, fileType: file.type });
      if (!req?.ok) {
        setPhase("upload");
        toast.error(req?.error.message ?? "Gagal menyiapkan upload.");
        return;
      }
      const supabase = createClient();
      const up = await supabase.storage
        .from(req.data.bucket)
        .upload(req.data.path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) {
        setPhase("upload");
        toast.error("Gagal mengunggah file.");
        return;
      }
      const res = await parseImportDocument({ projectId, path: req.data.path, fileName: file.name });
      if (!res?.ok) {
        setPhase("upload");
        toast.error(res?.error.message ?? "Gagal membaca dokumen.");
        return;
      }
      setTasks(res.data.tasks);
      setPhase("review");
    } catch {
      setPhase("upload");
      toast.error("Terjadi kesalahan saat memproses dokumen.");
    }
  }

  function updateTitle(i: number, title: string) {
    setTasks((ts) => ts.map((t, idx) => (idx === i ? { ...t, title } : t)));
  }
  function removeTask(i: number) {
    setTasks((ts) => ts.filter((_, idx) => idx !== i));
  }
  function removeImage(ti: number, ii: number) {
    setTasks((ts) =>
      ts.map((t, idx) => (idx === ti ? { ...t, images: t.images.filter((_, k) => k !== ii) } : t)),
    );
  }

  async function commit() {
    const clean = tasks.filter((t) => t.title.trim());
    if (clean.length === 0) {
      toast.error("Tidak ada task untuk dibuat.");
      return;
    }
    setPhase("committing");
    const res = await commitImportedTasks({
      projectId,
      statusId: statusId || null,
      tasks: clean.map((t) => ({
        title: t.title.trim(),
        description: t.description || undefined,
        images: t.images.map((im) => ({
          path: im.path,
          fileName: im.fileName,
          fileType: im.fileType,
          fileSize: im.fileSize,
        })),
      })),
    });
    if (!res?.ok) {
      setPhase("review");
      toast.error(res?.error.message ?? "Gagal membuat task.");
      return;
    }
    toast.success(`${res.data.count} task dibuat ke board`);
    onDone();
    router.refresh();
    close();
  }

  const reviewing = phase === "review" || phase === "committing";

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Import dari dokumen
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import task dari Word / PDF</DialogTitle>
            <DialogDescription>
              Upload laporan progress (daftar bernomor + screenshot). Sistem otomatis memecahnya
              jadi task di board, lengkap dengan gambarnya.
            </DialogDescription>
          </DialogHeader>

          {phase === "upload" && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center rounded-lg border border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <FileUp className="mb-3 size-8 text-muted-foreground" />
              <span className="text-sm font-medium">Pilih file Word (.docx) atau PDF</span>
              <span className="mt-1 text-xs text-muted-foreground">
                File Word memberikan gambar otomatis · PDF diproses sebagai teks · maks 25 MB
              </span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />

          {phase === "parsing" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              Membaca “{fileName}”…
            </div>
          )}

          {reviewing && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {tasks.length} task siap dibuat
                  <span className="ml-1 font-normal text-muted-foreground">— edit / hapus dulu bila perlu</span>
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Masukkan ke kolom</Label>
                  <Select value={statusId} onValueChange={setStatusId}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue placeholder="Kolom" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {tasks.map((t, i) => (
                  <div key={i} className="rounded-lg border p-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                        {i + 1}.
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          value={t.title}
                          onChange={(e) => updateTitle(i, e.target.value)}
                          className="h-8"
                          placeholder="Judul task"
                        />
                        {t.images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {t.images.map((im, k) => (
                              <div key={k} className="group relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={im.previewUrl}
                                  alt=""
                                  className="size-14 rounded border object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(i, k)}
                                  aria-label="Hapus gambar"
                                  className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-rose-600 p-0.5 text-white shadow group-hover:block"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-rose-600"
                        onClick={() => removeTask(i)}
                        aria-label="Hapus task"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                    <ImageOff className="size-6" />
                    Semua task dihapus.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {reviewing ? (
              <>
                <Button variant="ghost" onClick={close} disabled={phase === "committing"}>
                  Batal
                </Button>
                <Button onClick={commit} disabled={phase === "committing" || tasks.length === 0}>
                  {phase === "committing" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Membuat…
                    </>
                  ) : (
                    `Buat ${tasks.length} task`
                  )}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={close} disabled={phase === "parsing"}>
                Tutup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
