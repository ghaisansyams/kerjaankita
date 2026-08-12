"use client";

import { useEffect, useState } from "react";
import { Download, FileArchive, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDownloadUrl } from "@/features/attachments/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PortalFileVM = {
  id: string;
  taskId: string | null;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
};

export function formatBytes(n: number | null) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

type Kind = "pdf" | "image" | "office" | "archive" | "text" | "other";

/** Mime first, extension as the fallback — uploads don't always carry a type. */
function kindOf(file: PortalFileVM): Kind {
  const mime = (file.fileType ?? "").toLowerCase();
  const ext = file.fileName.toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (["zip", "rar", "7z"].includes(ext) || mime.includes("zip")) return "archive";
  if (mime.startsWith("text/") || ["txt", "csv", "json", "md"].includes(ext)) return "text";
  return "other";
}

const LABEL: Record<Kind, string> = {
  pdf: "PDF",
  image: "Gambar",
  office: "Dokumen",
  archive: "Arsip",
  text: "Teks",
  other: "File",
};

function FallbackIcon({ kind }: { kind: Kind }) {
  const Icon = kind === "archive" ? FileArchive : kind === "office" ? FileSpreadsheet : FileText;
  return <Icon className="size-10 text-muted-foreground" />;
}

/**
 * Preview first, download second.
 *
 * The URL comes from the same RLS-gated action the download button uses, so a
 * preview can't reach anything a download couldn't. It's fetched when the
 * dialog opens — never on page load — so opening the project doesn't pull every
 * attachment down with it.
 *
 * PDFs render in the browser's built-in viewer via <iframe>, which brings page
 * navigation, zoom and fit-to-width with it. Shipping pdf.js would mean a
 * worker bundle and a hand-built toolbar for controls the browser already has.
 */
export function FilePreviewDialog({
  file,
  onOpenChange,
}: {
  file: PortalFileVM | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const kind = file ? kindOf(file) : "other";
  const inlinePreview = kind === "pdf" || kind === "image";

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!file || !inlinePreview) return;

    let active = true;
    setLoading(true);
    getDownloadUrl({ id: file.id })
      .then((r) => {
        if (!active) return;
        if (r?.ok) setUrl(r.data.url);
        else setError(r?.error.message ?? "File ini tidak bisa dibuka.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [file, inlinePreview]);

  async function download() {
    if (!file) return;
    setDownloading(true);
    // Separate call with download=true so the browser saves it instead of
    // rendering it — same authorization, different Content-Disposition.
    const r = await getDownloadUrl({ id: file.id, download: true });
    setDownloading(false);
    if (r?.ok) window.open(r.data.url, "_blank", "noopener,noreferrer");
    else toast.error(r?.error.message ?? "That file isn't available.");
  }

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          inlinePreview
            ? "grid-cols-[minmax(0,1fr)] h-[90vh] max-h-[90vh] w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl"
            : "grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-md"
        }
      >
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle className="truncate pr-6 text-base">{file?.fileName ?? "File"}</DialogTitle>
          <DialogDescription>
            {LABEL[kind]}
            {file?.fileSize ? ` · ${formatBytes(file.fileSize)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
          {loading ? (
            <div className="flex h-full min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Menyiapkan pratinjau…
            </div>
          ) : error ? (
            <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 p-6 text-center">
              <FallbackIcon kind={kind} />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : inlinePreview && url ? (
            kind === "pdf" ? (
              <iframe
                src={url}
                title={`Pratinjau ${file?.fileName ?? ""}`}
                className="h-full min-h-[60vh] w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL; next/image can't optimize it */}
                <img
                  src={url}
                  alt={file?.fileName ?? ""}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-6 text-center">
              <FallbackIcon kind={kind} />
              <p className="text-sm font-medium">Pratinjau tidak tersedia untuk tipe file ini.</p>
              <p className="text-xs text-muted-foreground">
                Unduh filenya untuk membukanya di aplikasi yang sesuai.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {LABEL[kind]}
            {file?.fileSize ? ` · ${formatBytes(file.fileSize)}` : ""}
          </p>
          <Button size="sm" onClick={download} disabled={downloading}>
            <Download className="size-4" />
            {downloading ? "Menyiapkan…" : "Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
