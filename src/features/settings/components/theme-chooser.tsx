"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeChooser() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted ? (theme ?? "system") : undefined;

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const selected = active === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
              selected ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
