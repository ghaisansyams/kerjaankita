"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, KeyRound, Loader2, Sparkles, Trash2, ChevronDown } from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { GroqUsagePanel } from "./groq-usage-panel";
import {
  aiImportStatus,
  analyzeImportDocument,
  commitAiImport,
  expandImportTask,
  requestAiImportUpload,
} from "../ai-actions";
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
import { cn } from "@/lib/utils";

type Confidence = "high" | "medium" | "low";
type ChecklistItem = { text: string; confidence: Confidence; children?: { text: string; confidence: Confidence }[] };
type Feat = {
  name: string;
  description?: string;
  checklist: ChecklistItem[];
  acceptanceCriteria?: string[];
  roles?: string[];
  imageRefs?: number[];
  confidence: Confidence;
};
type Mod = { name: string; features: Feat[]; confidence: Confidence };
type Roadmap = { name: string; modules: Mod[]; confidence: Confidence };
type Analysis = {
  documentType: string;
  roles: string[];
  overallConfidence: Confidence;
  summary?: string;
  roadmaps: Roadmap[];
};
type Phase = "checking" | "disabled" | "upload" | "analyzing" | "expanding" | "preview" | "committing";

const IMPORT_EXTS = [".docx", ".pdf", ".xlsx", ".csv"];
const ACCEPT =
  ".docx,.pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/csv";
const MAX_BYTES = 25 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ConfBadge({ c }: { c: Confidence }) {
  const map: Record<Confidence, string> = {
    high: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    low: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  };
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", map[c])}>{c}</span>;
}

export function AiImportDialog({
  onDone,
  targetProjectId,
  targetProjectName,
}: {
  onDone: () => void;
  /** When opened from a project board, import INTO that project by default. */
  targetProjectId?: string;
  targetProjectName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [fileName, setFileName] = useState("");
  const [jobId, setJobId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [images, setImages] = useState<{ index: number; previewUrl: string }[]>([]);
  const [projectName, setProjectName] = useState("");
  const [dupStrategy, setDupStrategy] = useState<"skip" | "merge" | "duplicate">("duplicate");
  const [target, setTarget] = useState<"existing" | "new">(targetProjectId ? "existing" : "new");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandDone, setExpandDone] = useState(0);
  const [expandTotal, setExpandTotal] = useState(0);

  async function openDialog() {
    setOpen(true);
    setPhase("checking");
    const res = await aiImportStatus();
    setPhase(res?.ok && res.data.enabled ? "upload" : "disabled");
  }
  function reset() {
    setPhase("checking");
    setFileName("");
    setJobId("");
    setAnalysis(null);
    setImages([]);
    setProjectName("");
    setDupStrategy("duplicate");
    setTarget(targetProjectId ? "existing" : "new");
    setExpandDone(0);
    setExpandTotal(0);
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function onFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!IMPORT_EXTS.some((e) => lower.endsWith(e)))
      return toast.error("Hanya .docx, .pdf, .xlsx, atau .csv.");
    if (file.size > MAX_BYTES) return toast.error("File terlalu besar (maks 25 MB).");
    setFileName(file.name);
    setProjectName(file.name.replace(/\.(docx|pdf|xlsx|csv)$/i, "").replace(/[_-]+/g, " ").trim());
    setPhase("analyzing");
    try {
      const req = await requestAiImportUpload({ fileName: file.name, fileType: file.type });
      if (!req?.ok) {
        setPhase("upload");
        return toast.error(req?.error.message ?? "Gagal menyiapkan upload.");
      }
      const res = await analyzeImportDocument({
        bucket: req.data.bucket,
        path: req.data.path,
        fileName: file.name,
        fileType: file.type,
      });
      if (!res?.ok) {
        if (res?.error.code === "NOT_CONFIGURED") setPhase("disabled");
        else {
          setPhase("upload");
          toast.error(res?.error.message ?? "Gagal menganalisis dokumen.");
        }
        return;
      }
      const jid = res.data.jobId;
      setJobId(jid);
      let analysis = res.data.analysis as Analysis;
      setAnalysis(analysis);
      setImages((res.data.images ?? []).map((i) => ({ index: i.index, previewUrl: i.previewUrl })));

      // PASS 2: expand every area into a COMPLETE nested checklist, one focused
      // call each so the model lists every sub-module and leaf.
      const refs: { r: number; m: number; f: number }[] = [];
      analysis.roadmaps.forEach((rm, r) =>
        rm.modules.forEach((mod, m) => mod.features.forEach((_, f) => refs.push({ r, m, f }))),
      );
      setExpandTotal(refs.length);
      setExpandDone(0);
      setPhase("expanding");
      // Each call reserves its max_tokens against the free tier's ~12k tokens/min,
      // so pace conservatively to avoid rate limits; a 429 still waits a full
      // window and retries. Slow but complete — the whole point of this step.
      const PACE_MS = 16000;
      let failed = 0;
      for (let i = 0; i < refs.length; i++) {
        const { r, m, f } = refs[i];
        let ex = await expandImportTask({ jobId: jid, roadmapIndex: r, moduleIndex: m, featureIndex: f });
        let attempts = 0;
        while (
          !ex?.ok &&
          /rate|tokens per minute|429|too large|limit/i.test(ex?.error.message ?? "") &&
          attempts < 2
        ) {
          attempts++;
          await sleep(60000); // wait a full per-minute window, then retry
          ex = await expandImportTask({ jobId: jid, roadmapIndex: r, moduleIndex: m, featureIndex: f });
        }
        if (ex?.ok && (ex.data.checklist?.length ?? 0) > 0) {
          analysis = structuredClone(analysis);
          analysis.roadmaps[r].modules[m].features[f].checklist = ex.data.checklist as ChecklistItem[];
          setAnalysis(analysis);
        } else {
          failed++;
        }
        setExpandDone(i + 1);
        if (i < refs.length - 1) await sleep(PACE_MS);
      }
      if (failed > 0) {
        toast(`${failed} area belum sempat diperinci (batas AI gratis) — bisa impor ulang nanti.`);
      }
      setPhase("preview");
    } catch {
      setPhase("upload");
      toast.error("Terjadi kesalahan.");
    }
  }

  // ---- editing helpers (immutable) ----
  function mutate(fn: (a: Analysis) => void) {
    setAnalysis((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as Analysis;
      fn(next);
      return next;
    });
  }
  const counts = analysis
    ? analysis.roadmaps.reduce(
        (acc, r) => {
          acc.roadmaps++;
          r.modules.forEach((m) => {
            acc.modules++;
            acc.features += m.features.length;
            m.features.forEach(
              (f) =>
                (acc.checklist += f.checklist.reduce((n, c) => n + 1 + (c.children?.length ?? 0), 0)),
            );
          });
          return acc;
        },
        { roadmaps: 0, modules: 0, features: 0, checklist: 0 },
      )
    : null;

  async function commit() {
    if (!analysis) return;
    const intoExisting = target === "existing" && !!targetProjectId;
    if (!intoExisting && !projectName.trim()) return toast.error("Isi nama project dulu.");
    setPhase("committing");
    const res = await commitAiImport(
      intoExisting
        ? { jobId, projectId: targetProjectId, duplicateStrategy: dupStrategy, analysis }
        : { jobId, projectName: projectName.trim(), duplicateStrategy: dupStrategy, analysis },
    );
    if (!res?.ok) {
      setPhase("preview");
      return toast.error(res?.error.message ?? "Gagal membuat project.");
    }
    toast.success(
      intoExisting
        ? `Ditambahkan ke project: ${res.data.tasks} task, ${res.data.modules} modul`
        : `Project dibuat: ${res.data.roadmaps} roadmap, ${res.data.modules} modul, ${res.data.tasks} task`,
    );
    onDone();
    close();
    router.push(`/projects/${res.data.projectId}/board`);
  }

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        <Sparkles className="size-4" /> AI Project Import
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>AI Project Import</DialogTitle>
            <DialogDescription>
              Upload dokumen spesifikasi (SRS, feature spec, scope, MOM, laporan). AI membaca
              strukturnya dan menyusun Roadmap → Modul → Feature (task) → Checklist otomatis.
            </DialogDescription>
          </DialogHeader>

          {phase === "checking" && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Memeriksa ketersediaan AI…
            </div>
          )}

          {phase === "disabled" && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
              <div className="flex items-center gap-2 font-medium">
                <KeyRound className="size-4 text-amber-500" /> AI import belum aktif
              </div>
              <p className="text-sm text-muted-foreground">
                Seluruh pipeline sudah terpasang, tapi butuh <code>ANTHROPIC_API_KEY</code> untuk
                mulai membaca dokumen. Begitu key ditambahkan, fitur langsung aktif tanpa perubahan
                lain.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Buat API key di console.anthropic.com → API Keys.</li>
                <li>Tambahkan sebagai environment variable <code>ANTHROPIC_API_KEY</code> di Vercel.</li>
                <li>Redeploy — tombol ini otomatis membaca dokumen.</li>
              </ol>
            </div>
          )}

          {phase === "upload" && (
            <div className="space-y-3">
              <FileDropzone accept={ACCEPT} onFile={onFile}>
                <FileUp className="mb-3 size-8 text-muted-foreground" />
                <span className="text-sm font-medium">Tarik &amp; letakkan, atau pilih dokumen (.docx / .pdf / .xlsx / .csv)</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  AI mengerti SRS, feature/functional spec, scope, MOM, client requirements · maks 25 MB
                </span>
              </FileDropzone>
              <GroqUsagePanel />
            </div>
          )}

          {phase === "analyzing" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              AI membaca struktur “{fileName}”…
            </div>
          )}

          {phase === "expanding" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <div className="font-medium text-foreground">Memperinci setiap area jadi checklist lengkap…</div>
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-xs tabular-nums">
                  <span>{expandDone}/{expandTotal} area</span>
                  <span>{expandTotal ? Math.round((expandDone / expandTotal) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${expandTotal ? (expandDone / expandTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="max-w-xs text-center text-xs">
                Dokumen besar bisa perlu beberapa menit (batas AI gratis). Jangan tutup dialog ini.
              </div>
            </div>
          )}

          {(phase === "preview" || phase === "committing") && analysis && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                {targetProjectId && (
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Tujuan import</Label>
                    <Select value={target} onValueChange={(v) => setTarget(v as "existing" | "new")}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">
                          Tambah ke project ini{targetProjectName ? ` — ${targetProjectName}` : ""}
                        </SelectItem>
                        <SelectItem value="new">Buat project baru</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(!targetProjectId || target === "new") && (
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nama project baru</Label>
                    <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-8" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Jika duplikat</Label>
                  <Select value={dupStrategy} onValueChange={(v) => setDupStrategy(v as typeof dupStrategy)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="duplicate">Duplikat</SelectItem>
                      <SelectItem value="skip">Lewati</SelectItem>
                      <SelectItem value="merge">Gabung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{analysis.documentType}</span>
                <ConfBadge c={analysis.overallConfidence} />
                {counts && (
                  <span>
                    {counts.roadmaps} roadmap · {counts.modules} modul · {counts.features} feature ·{" "}
                    {counts.checklist} checklist · {images.length} gambar
                  </span>
                )}
                {analysis.roles.length > 0 && <span>· Roles: {analysis.roles.join(", ")}</span>}
              </div>

              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {analysis.roadmaps.map((rm, ri) => (
                  <div key={ri} className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roadmap</span>
                      <span className="text-sm font-semibold">{rm.name}</span>
                      <ConfBadge c={rm.confidence} />
                      <Button variant="ghost" size="icon" className="ml-auto size-7"
                        onClick={() => mutate((a) => { a.roadmaps.splice(ri, 1); })}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-2 p-2">
                      {rm.modules.map((mod, mi) => (
                        <div key={mi} className="rounded border">
                          <div className="flex items-center gap-2 px-2.5 py-1.5">
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Modul</span>
                            <span className="text-sm font-medium">{mod.name}</span>
                            <ConfBadge c={mod.confidence} />
                            <Button variant="ghost" size="icon" className="ml-auto size-6"
                              onClick={() => mutate((a) => { a.roadmaps[ri].modules.splice(mi, 1); })}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <div className="space-y-1.5 px-2.5 pb-2">
                            {mod.features.map((f, fi) => {
                              const k = `${ri}-${mi}-${fi}`;
                              return (
                                <div key={fi} className="rounded bg-muted/30 p-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => setExpanded((e) => ({ ...e, [k]: !e[k] }))}
                                      className="text-muted-foreground">
                                      <ChevronDown className={cn("size-3.5 transition-transform", expanded[k] && "rotate-180")} />
                                    </button>
                                    <Input value={f.name} className="h-7 flex-1 bg-background"
                                      onChange={(e) => mutate((a) => { a.roadmaps[ri].modules[mi].features[fi].name = e.target.value; })} />
                                    <ConfBadge c={f.confidence} />
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      {f.checklist.reduce((n, c) => n + 1 + (c.children?.length ?? 0), 0)}✓
                                    </span>
                                    <Button variant="ghost" size="icon" className="size-6"
                                      onClick={() => mutate((a) => { a.roadmaps[ri].modules[mi].features.splice(fi, 1); })}>
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                  {f.roles && f.roles.length > 0 && (
                                    <div className="ml-6 mt-1 flex flex-wrap items-center gap-1">
                                      <span className="text-[10px] font-medium text-muted-foreground">Hak akses:</span>
                                      {f.roles.map((role, rri) => (
                                        <span
                                          key={rri}
                                          className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400"
                                        >
                                          {role}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {expanded[k] && f.checklist.length > 0 && (
                                    <ul className="ml-6 mt-1.5 space-y-1">
                                      {f.checklist.map((c, ci) => (
                                        <li key={ci} className="space-y-1">
                                          <div className="flex items-center gap-1.5 text-xs">
                                            <span className="text-muted-foreground">☐</span>
                                            <span className="flex-1 font-medium">{c.text}</span>
                                            <ConfBadge c={c.confidence} />
                                          </div>
                                          {c.children && c.children.length > 0 && (
                                            <ul className="ml-4 space-y-0.5 border-l pl-2.5">
                                              {c.children.map((cc, cci) => (
                                                <li
                                                  key={cci}
                                                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                                >
                                                  <span>☐</span>
                                                  <span className="flex-1">{cc.text}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {phase === "preview" || phase === "committing" ? (
              <>
                <Button variant="ghost" onClick={close} disabled={phase === "committing"}>Batal</Button>
                <Button onClick={commit} disabled={phase === "committing" || !counts?.features}>
                  {phase === "committing" ? (
                    <><Loader2 className="size-4 animate-spin" /> Menyimpan…</>
                  ) : target === "existing" && targetProjectId ? (
                    `Tambah ke project (${counts?.features ?? 0} task)`
                  ) : (
                    `Buat project (${counts?.features ?? 0} task)`
                  )}
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={close} disabled={phase === "analyzing" || phase === "expanding"}>Tutup</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
