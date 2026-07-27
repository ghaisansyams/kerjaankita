"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setNotificationPreference } from "../actions";
import { NOTIFICATION_TYPES } from "../constants";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function NotificationPreferences({
  initial,
}: {
  /** type → in-app enabled (missing = enabled by default). */
  initial: Record<string, boolean>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [, startTransition] = useTransition();

  function toggle(type: string, next: boolean) {
    setState((s) => ({ ...s, [type]: next }));
    startTransition(async () => {
      const r = await setNotificationPreference({ type, inApp: next });
      if (!r?.ok) {
        setState((s) => ({ ...s, [type]: !next })); // rollback
        toast.error("Couldn't save preference");
      }
    });
  }

  return (
    <Card className="divide-y p-0">
      <div className="p-3">
        <h2 className="text-sm font-medium">Preferences</h2>
        <p className="text-xs text-muted-foreground">Choose which in-app notifications you receive.</p>
      </div>
      {NOTIFICATION_TYPES.map((n) => {
        const enabled = state[n.type] ?? true;
        const id = `pref-${n.type}`;
        const Icon = n.icon;
        return (
          <div key={n.type} className="flex items-center gap-3 p-3">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${n.tone}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Label htmlFor={id} className="text-sm font-medium">
                {n.label}
              </Label>
              <p className="text-xs text-muted-foreground">{n.description}</p>
            </div>
            <Switch
              id={id}
              checked={enabled}
              onCheckedChange={(v) => toggle(n.type, v)}
              aria-label={`${n.label} in-app notifications`}
            />
          </div>
        );
      })}
    </Card>
  );
}
