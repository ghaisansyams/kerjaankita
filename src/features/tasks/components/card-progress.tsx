"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DONE = "#10b981"; // emerald-500

/** A small progress ring. Filled arc uses the theme primary, or emerald at 100%. */
export function ProgressRingMini({
  value,
  size = 34,
  stroke = 3.5,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const done = clamped >= 100;
  return (
    <span className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? DONE : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset,stroke] duration-500 ease-out"
        />
      </svg>
      <span className="absolute grid place-items-center">
        {done ? (
          <Check className="size-3.5 text-emerald-500" strokeWidth={3} />
        ) : (
          <span className="text-[9px] font-semibold tabular-nums text-foreground/80">{clamped}</span>
        )}
      </span>
    </span>
  );
}

/**
 * The inline, no-dialog progress editor (QA redesign signature). Read-only shows
 * just the ring; editable makes the ring a popover trigger with a step-10 slider
 * and quick presets. Updates are optimistic — `onChange` returns a rejected
 * promise to trigger a revert.
 */
export function InlineProgress({
  value,
  editable,
  onChange,
  size = 34,
}: {
  value: number;
  editable: boolean;
  onChange: (next: number) => Promise<boolean>;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(value), [value]);

  async function commit(next: number) {
    if (next === value) return;
    setBusy(true);
    const ok = await onChange(next);
    setBusy(false);
    if (!ok) setDraft(value); // revert on failure
  }

  if (!editable) return <ProgressRingMini value={value} size={size} />;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Progress ${value}%. Click to change.`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "rounded-full outline-none ring-ring ring-offset-1 ring-offset-card transition hover:scale-105 focus-visible:ring-2",
            busy && "opacity-70",
          )}
        >
          <ProgressRingMini value={draft} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 space-y-3"
        align="center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">Progress</span>
          <span className="font-display text-lg font-semibold tabular-nums">{draft}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={() => commit(draft)}
          onKeyUp={() => commit(draft)}
          aria-label="Progress percentage"
          className="w-full cursor-pointer accent-primary"
        />
        <div className="flex gap-1.5">
          {[0, 50, 100].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setDraft(v);
                commit(v);
              }}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                draft === v
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {v === 0 ? "None" : v === 100 ? "Done" : "Half"}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
