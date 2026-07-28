"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddColumn({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-[220px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="size-4" /> Add column
      </button>
    );
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2 self-start rounded-xl border bg-card p-2 shadow-sm">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        placeholder="Column name"
        maxLength={40}
        className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex gap-1.5">
        <Button size="sm" className="h-7 flex-1" onClick={submit} disabled={!name.trim()}>
          Add column
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          aria-label="Cancel"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
