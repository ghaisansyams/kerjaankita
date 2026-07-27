"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import { Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment, editComment } from "@/features/comments/actions";
import { humanizeActivity } from "@/utils/humanize-activity";
import { formatRelative, getInitials, toDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type CommentVM = {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  isEdited: boolean;
  createdAt: string;
};

export type ActivityVM = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  actorName: string | null;
  actorAvatar: string | null;
  createdAt: string;
};

type Item =
  | { kind: "comment"; at: number; c: CommentVM }
  | { kind: "activity"; at: number; a: ActivityVM };

function dayLabel(iso: string) {
  const d = toDate(iso);
  if (!d) return "";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
}

export function ActivityTimeline({
  taskId,
  comments,
  activities,
  statuses,
  members,
  currentUserId,
  canComment,
  canModerate,
}: {
  taskId: string;
  comments: CommentVM[];
  activities: ActivityVM[];
  statuses: { id: string; name: string }[];
  members: { id: string; name: string }[];
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const statusName = useMemo(() => {
    const m = new Map(statuses.map((s) => [s.id, s.name]));
    return (id: unknown) => (typeof id === "string" ? m.get(id) ?? null : null);
  }, [statuses]);
  const memberName = useMemo(() => {
    const m = new Map(members.map((x) => [x.id, x.name]));
    return (id: unknown) => (typeof id === "string" ? m.get(id) ?? null : null);
  }, [members]);

  const groups = useMemo(() => {
    const items: Item[] = [
      ...comments.map((c) => ({ kind: "comment" as const, c, at: toDate(c.createdAt)?.getTime() ?? 0 })),
      ...activities
        .filter((a) => a.action !== "comment.created")
        .map((a) => ({ kind: "activity" as const, a, at: toDate(a.createdAt)?.getTime() ?? 0 })),
    ].sort((x, y) => y.at - x.at);

    const out: { label: string; items: Item[] }[] = [];
    for (const it of items) {
      const label = dayLabel(it.kind === "comment" ? it.c.createdAt : it.a.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(it);
      else out.push({ label, items: [it] });
    }
    return out;
  }, [comments, activities]);

  function post() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await addComment({ taskId, body });
      if (r?.ok) {
        setDraft("");
        router.refresh();
      } else {
        toast.error(r?.error.message ?? "Couldn't post comment");
      }
    });
  }

  function saveEdit(id: string) {
    const body = editValue.trim();
    setEditingId(null);
    if (!body) return;
    startTransition(async () => {
      const r = await editComment({ id, body });
      if (r?.ok) router.refresh();
      else toast.error(r?.error.message ?? "Couldn't edit comment");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteComment({ id });
      if (r?.ok) router.refresh();
      else toast.error(r?.error.message ?? "Couldn't delete comment");
    });
  }

  return (
    <div className="space-y-4">
      {canComment && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={post} disabled={pending || !draft.trim()}>
              <Send className="size-4" />
              Comment
            </Button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.label} className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
              <ul className="space-y-3">
                {g.items.map((it) =>
                  it.kind === "comment" ? (
                    <li key={`c-${it.c.id}`} className="flex gap-2.5">
                      <Avatar className="mt-0.5 size-7 shrink-0">
                        {it.c.authorAvatar && <AvatarImage src={it.c.authorAvatar} alt="" />}
                        <AvatarFallback className="text-[10px]">
                          {getInitials(it.c.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="group flex items-baseline gap-2">
                          <span className="text-sm font-medium">{it.c.authorName ?? "Someone"}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(it.c.createdAt)}
                            {it.c.isEdited ? " · edited" : ""}
                          </span>
                          {(it.c.authorId === currentUserId || canModerate) && editingId !== it.c.id && (
                            <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              {it.c.authorId === currentUserId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  aria-label="Edit comment"
                                  onClick={() => {
                                    setEditingId(it.c.id);
                                    setEditValue(it.c.body);
                                  }}
                                >
                                  <Pencil className="size-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                aria-label="Delete comment"
                                onClick={() => remove(it.c.id)}
                                disabled={pending}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </span>
                          )}
                        </div>
                        {editingId === it.c.id ? (
                          <div className="mt-1 space-y-1.5">
                            <Textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={() => saveEdit(it.c.id)} disabled={pending}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-foreground/90">{it.c.body}</p>
                        )}
                      </div>
                    </li>
                  ) : (
                    <li key={`a-${it.a.id}`} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Avatar className="size-5 shrink-0">
                        {it.a.actorAvatar && <AvatarImage src={it.a.actorAvatar} alt="" />}
                        <AvatarFallback className="text-[8px]">
                          {getInitials(it.a.actorName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{it.a.actorName ?? "Someone"}</span>{" "}
                        {humanizeActivity(it.a.action, it.a.metadata, { statusName, memberName })}
                      </span>
                      <span className={cn("shrink-0 text-xs")}>{formatRelative(it.a.createdAt)}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
