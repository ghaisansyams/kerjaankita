"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Workflow } from "lucide-react";
import { commitImportedTasks, type ImportPreviewTask } from "../actions";
import { jiraStatus, listJiraProjects, previewJiraIssues } from "../jira-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
type Phase = "checking" | "disabled" | "pick" | "loading" | "review" | "committing";

export function JiraImportDialog({
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
  const [phase, setPhase] = useState<Phase>("checking");
  const [account, setAccount] = useState<string | null>(null);
  const [jiraProjects, setJiraProjects] = useState<{ key: string; name: string }[]>([]);
  const [jiraKey, setJiraKey] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [tasks, setTasks] = useState<ImportPreviewTask[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");

  async function openDialog() {
    setOpen(true);
    setPhase("checking");
    const st = await jiraStatus();
    if (!st?.ok || !st.data.enabled) {
      setPhase("disabled");
      return;
    }
    setAccount(st.data.account);
    const list = await listJiraProjects();
    if (list?.ok) {
      setJiraProjects(list.data);
      setJiraKey((k) => k || list.data[0]?.key || "");
    }
    setPhase("pick");
  }

  function reset() {
    setPhase("checking");
    setTasks([]);
    setTruncated(false);
    setJiraKey("");
    setOpenOnly(false);
    setStatusId(statuses[0]?.id ?? "");
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function load() {
    if (!jiraKey.trim()) return toast.error("Pilih project Jira dulu.");
    setPhase("loading");
    const res = await previewJiraIssues({ projectId, projectKey: jiraKey.trim(), openOnly });
    if (!res?.ok) {
      setPhase("pick");
      return toast.error(res?.error.message ?? "Gagal mengambil issue dari Jira.");
    }
    if (res.data.tasks.length === 0) {
      setPhase("pick");
      return toast.error("Tidak ada issue yang cocok di project itu.");
    }
    setTasks(res.data.tasks);
    setTruncated(res.data.truncated);
    setPhase("review");
  }

  async function commit() {
    const clean = tasks.filter((t) => t.title.trim());
    if (!clean.length) return toast.error("Tidak ada task untuk dibuat.");
    setPhase("committing");
    const res = await commitImportedTasks({
      projectId,
      statusId: statusId || null,
      tasks: clean.map((t) => ({
        title: t.title.trim(),
        description: t.description || undefined,
        images: [],
      })),
    });
    if (!res?.ok) {
      setPhase("review");
      return toast.error(res?.error.message ?? "Gagal membuat task.");
    }
    toast.success(`${res.data.count} task dibuat ke board`);
    onDone();
    router.refresh();
    close();
  }

  const reviewing = phase === "review" || phase === "committing";

  return (
    <>
      <Button size="sm" variant="outline" onClick={openDialog}>
        <Workflow className="size-4" /> Import dari Jira
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import task dari Jira</DialogTitle>
            <DialogDescription>
              Ambil issue langsung dari Jira, tanpa ekspor CSV.
              {account ? ` Terhubung sebagai ${account}.` : ""}
            </DialogDescription>
          </DialogHeader>

          {phase === "checking" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              Mengecek koneksi Jira…
            </div>
          )}

          {phase === "disabled" && (
            <div className="space-y-2 py-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Jira belum terhubung</p>
              <p>
                Isi JIRA_BASE_URL, JIRA_EMAIL, dan JIRA_API_TOKEN di environment,
                lalu buka lagi dialog ini.
              </p>
            </div>
          )}

          {(phase === "pick" || phase === "loading") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Project Jira</Label>
                {jiraProjects.length > 0 ? (
                  <Select value={jiraKey} onValueChange={setJiraKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih project" />
                    </SelectTrigger>
                    <SelectContent>
                      {jiraProjects.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.key} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // Falls back to free text when the token can list issues but
                  // not browse the project directory.
                  <Input
                    placeholder="ONELITO"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value.toUpperCase())}
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={openOnly}
                  onCheckedChange={(v) => setOpenOnly(v === true)}
                />
                Hanya issue yang belum selesai
              </label>

              <DialogFooter>
                <Button variant="ghost" onClick={close} disabled={phase === "loading"}>
                  Batal
                </Button>
                <Button onClick={load} disabled={phase === "loading"}>
                  {phase === "loading" ? "Mengambil…" : "Ambil issue"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {reviewing && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {tasks.length} task siap dibuat
                  <span className="ml-1 font-normal text-muted-foreground">
                    — hapus dulu yang tidak perlu
                  </span>
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

              {truncated && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Project ini punya lebih dari 100 issue. Yang diambil 100 tertua —
                  import lagi setelah ini untuk sisanya.
                </p>
              )}

              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Hapus task ini"
                      onClick={() => setTasks((ts) => ts.filter((_, k) => k !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={close} disabled={phase === "committing"}>
                  Batal
                </Button>
                <Button onClick={commit} disabled={phase === "committing"}>
                  {phase === "committing" ? "Membuat…" : `Buat ${tasks.length} task`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
