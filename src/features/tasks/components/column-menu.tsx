"use client";

import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SWATCHES = [
  "#64748B", "#6366F1", "#2563EB", "#0EA5E9", "#7C3AED", "#DB2777",
  "#059669", "#0D9488", "#D97706", "#EA580C", "#DC2626", "#4B5563",
];
const WEIGHTS = [0, 25, 50, 75, 90, 100];

export function ColumnMenu({
  color,
  weight,
  isDefault,
  isCompleted,
  onStartRename,
  onRecolor,
  onWeight,
  onSetDefault,
  onToggleCompleted,
  onDelete,
}: {
  color: string;
  weight: number;
  isDefault: boolean;
  isCompleted: boolean;
  onStartRename: () => void;
  onRecolor: (hex: string) => void;
  onWeight: (w: number) => void;
  onSetDefault: () => void;
  onToggleCompleted: (next: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground/60 transition-colors hover:text-foreground data-[state=open]:text-foreground"
          aria-label="Column options"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onStartRename}>
          <Pencil className="size-4" /> Rename
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="mr-2 size-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />
            Change color
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="grid grid-cols-6 gap-1 p-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Set color ${c}`}
                onClick={() => onRecolor(c)}
                className={cn(
                  "grid size-6 place-items-center rounded-md ring-1 ring-black/10 transition-transform hover:scale-110",
                  c.toLowerCase() === color.toLowerCase() && "ring-2 ring-foreground",
                )}
                style={{ backgroundColor: c }}
              >
                {c.toLowerCase() === color.toLowerCase() && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Progress weight
            <span className="ml-auto tabular-nums text-xs text-muted-foreground">{weight}%</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Task progress on entering
            </DropdownMenuLabel>
            {WEIGHTS.map((w) => (
              <DropdownMenuItem key={w} onSelect={() => onWeight(w)}>
                {w}%{w === weight && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {!isDefault && (
          <DropdownMenuItem onSelect={onSetDefault}>Set as default column</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onToggleCompleted(!isCompleted)}>
          {isCompleted ? "Unmark as completed" : "Mark as completed"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
