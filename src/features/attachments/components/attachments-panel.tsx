"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, EyeOff, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/format";
import {
  deleteAttachment,
  getDownloadUrl,
  registerAttachment,
  requestUpload,
  shareAttachment,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type AttachmentVM = {
  id: string;
  fileName: string;
  fileSize: number | null;
  uploaderId: string | null;
  uploaderName: string | null;
  isGuestVisible: boolean;
  createdAt: string;
};

function formatBytes(n: number | null) {
  if (n == null) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function AttachmentsPanel({
  projectId,
  taskId,
  attachments,
  canUpload,
  canManage,
  currentUserId,
}: {
  projectId: string;
  taskId: string;
  attachments: AttachmentVM[];
  canUpload: boolean;
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileType = file.type || "application/octet-stream";
        const req = await requestUpload({
          projectId,
          taskId,
          fileName: file.name,
          fileType,
          fileSize: file.size,
        });
        if (!req?.ok) {
          toast.error(req?.error.message ?? `Couldn't upload ${file.name}`);
          continue;
        }
        const supabase = createClient();
        const { error } = await supabase.storage
          .from(req.data.bucket)
          .upload(req.data.path, file, { contentType: file.type || undefined, upsert: false });
        if (error) {
          toast.error(`Couldn't upload ${file.name}`);
          continue;
        }
        const reg = await registerAttachment({
          projectId,
          taskId,
          path: req.data.path,
          fileName: file.name,
          fileType,
          fileSize: file.size,
        });
        if (!reg?.ok) {
          // Registration failed after the object landed in Storage — delete it
          // so we never leave an orphaned object behind (QA RC1 · M3). The
          // uploader owns the object, so this is allowed by the bucket policy.
          await supabase.storage.from(req.data.bucket).remove([req.data.path]);
          toast.error(reg?.error.message ?? "Couldn't save file");
        }
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function download(id: string) {
    startTransition(async () => {
      const r = await getDownloadUrl({ id });
      if (r?.ok) window.open(r.data.url, "_blank", "noopener,noreferrer");
      else toast.error(r?.error.message ?? "Couldn't download");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteAttachment({ id });
      if (r?.ok) {
        toast.success("File deleted");
        router.refresh();
      } else {
        toast.error(r?.error.message ?? "Couldn't delete file");
      }
    });
  }

  function toggleShare(id: string, shared: boolean) {
    startTransition(async () => {
      const r = await shareAttachment({ id, projectId, shared });
      if (r?.ok) {
        toast.success(shared ? "Shared with client" : "Hidden from client");
        router.refresh();
      } else {
        toast.error(r?.error.message ?? "Couldn't update sharing");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Files</h3>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </Button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <Card className="divide-y p-0">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {a.fileName}
                  {a.isGuestVisible && (
                    <span className="ml-1.5 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Shared
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatBytes(a.fileSize)}
                  {a.uploaderName ? ` · ${a.uploaderName}` : ""} ·{" "}
                  {formatDate(a.createdAt, "MMM d")}
                </p>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("size-8", a.isGuestVisible && "text-emerald-600 dark:text-emerald-400")}
                  aria-label={a.isGuestVisible ? `Stop sharing ${a.fileName}` : `Share ${a.fileName} with client`}
                  title={a.isGuestVisible ? "Shared with client" : "Share with client"}
                  onClick={() => toggleShare(a.id, !a.isGuestVisible)}
                  disabled={pending}
                >
                  {a.isGuestVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Download ${a.fileName}`}
                onClick={() => download(a.id)}
                disabled={pending}
              >
                <Download className="size-4" />
              </Button>
              {(canManage || a.uploaderId === currentUserId) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Delete ${a.fileName}`}
                  onClick={() => remove(a.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
