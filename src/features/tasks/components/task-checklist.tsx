"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
} from "../checklist-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChecklistItemVM = { id: string; content: string; isDone: boolean; depth?: number };

export function TaskChecklist({
  taskId,
  items: initial,
  canEdit,
}: {
  taskId: string;
  items: ChecklistItemVM[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState<ChecklistItemVM[]>(initial);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const doneCount = items.filter((i) => i.isDone).length;

  // Group the flat, depth-tagged list into parents + their sub-items so long
  // checklists (e.g. an imported area with many sub-modules) can collapse.
  const groups = useMemo(() => {
    const g: { parent: ChecklistItemVM; children: ChecklistItemVM[] }[] = [];
    for (const it of items) {
      if ((it.depth ?? 0) === 0 || g.length === 0) g.push({ parent: it, children: [] });
      else g[g.length - 1].children.push(it);
    }
    return g;
  }, [items]);
  const hasNesting = groups.some((gr) => gr.children.length > 0);
  const allOpen = hasNesting && groups.every((gr) => gr.children.length === 0 || open[gr.parent.id]);

  function setAllOpen(v: boolean) {
    const next: Record<string, boolean> = {};
    groups.forEach((gr) => {
      if (gr.children.length) next[gr.parent.id] = v;
    });
    setOpen(next);
  }

  function add() {
    const content = draft.trim();
    if (!content) return;
    const tempId = crypto.randomUUID();
    setItems((prev) => [...prev, { id: tempId, content, isDone: false, depth: 0 }]);
    setDraft("");
    startTransition(async () => {
      const r = await addChecklistItem({ taskId, content });
      if (r?.ok) {
        setItems((prev) => prev.map((i) => (i.id === tempId ? { ...i, id: r.data.id } : i)));
      } else {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        toast.error(r?.error.message ?? "Couldn't add item");
      }
    });
  }

  function toggle(item: ChecklistItemVM) {
    const next = !item.isDone;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isDone: next } : i)));
    startTransition(async () => {
      const r = await toggleChecklistItem({ id: item.id, isDone: next });
      if (!r?.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isDone: item.isDone } : i)));
        toast.error(r?.error.message ?? "Couldn't update item");
      }
    });
  }

  function remove(item: ChecklistItemVM) {
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const r = await deleteChecklistItem({ id: item.id });
      if (!r?.ok) {
        setItems(snapshot);
        toast.error(r?.error.message ?? "Couldn't delete item");
      }
    });
  }

  function saveEdit(item: ChecklistItemVM) {
    const content = editValue.trim();
    setEditingId(null);
    if (!content || content === item.content) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, content } : i)));
    startTransition(async () => {
      const r = await updateChecklistItem({ id: item.id, content });
      if (!r?.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, content: item.content } : i)));
        toast.error(r?.error.message ?? "Couldn't save item");
      }
    });
  }

  function itemBody(item: ChecklistItemVM) {
    return (
      <>
        <Checkbox
          checked={item.isDone}
          onCheckedChange={() => canEdit && toggle(item)}
          disabled={!canEdit}
          aria-label={item.content}
        />
        {editingId === item.id ? (
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(item);
              if (e.key === "Escape") setEditingId(null);
            }}
            className="h-7"
          />
        ) : (
          <span
            className={cn(
              "flex-1 text-sm",
              item.isDone && "text-muted-foreground line-through",
              canEdit && "cursor-text",
            )}
            onClick={() => {
              if (canEdit) {
                setEditingId(item.id);
                setEditValue(item.content);
              }
            }}
          >
            {item.content}
          </span>
        )}
        {canEdit && editingId !== item.id && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 group-hover:opacity-100"
            aria-label={`Delete ${item.content}`}
            onClick={() => remove(item)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Checklist</h3>
        <div className="flex items-center gap-3">
          {hasNesting && (
            <button
              type="button"
              onClick={() => setAllOpen(!allOpen)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {allOpen ? "Tutup semua" : "Buka semua"}
            </button>
          )}
          {items.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {doneCount}/{items.length}
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-1">
        {groups.map((gr) => {
          const hasChildren = gr.children.length > 0;
          const isOpen = !!open[gr.parent.id];
          const childDone = gr.children.filter((c) => c.isDone).length;
          return (
            <li key={gr.parent.id} className="list-none">
              <div className="group flex items-center gap-1.5">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [gr.parent.id]: !o[gr.parent.id] }))}
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                  </button>
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                {itemBody(gr.parent)}
                {hasChildren && (
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {childDone}/{gr.children.length}
                  </span>
                )}
              </div>
              {hasChildren && isOpen && (
                <ul className="mt-1 space-y-1">
                  {gr.children.map((ch) => (
                    <li key={ch.id} className="group flex items-center gap-2 ml-6 border-l pl-3">
                      {itemBody(ch)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add an item…"
            className="h-8"
          />
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={add}
            disabled={!draft.trim()}
            aria-label="Add checklist item"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {items.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">No checklist items.</p>
      )}
    </div>
  );
}
