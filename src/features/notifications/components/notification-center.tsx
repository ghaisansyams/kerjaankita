"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils/format";
import { markAllNotificationsRead, markNotificationRead } from "../actions";
import { notificationHref, notificationMeta } from "../constants";
import { Button } from "@/components/ui/button";

export type NotificationVM = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationCenter({
  userId,
  initialItems,
}: {
  userId: string;
  initialItems: NotificationVM[];
}) {
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [, startTransition] = useTransition();

  useEffect(() => setItems(initialItems), [initialItems]);

  // Realtime: new notifications for this user arrive live.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as NotificationVM;
          setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((n) => !n.is_read).length;
  const shown = tab === "unread" ? items.filter((n) => !n.is_read) : items;

  function read(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    startTransition(async () => {
      await markNotificationRead({ id });
    });
  }

  function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(async () => {
      const r = await markAllNotificationsRead();
      if (!r?.ok) toast.error("Couldn't mark all read");
    });
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex rounded-md border p-0.5" role="tablist" aria-label="Filter notifications">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {t === "unread" && unread > 0 ? ` (${unread})` : ""}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={readAll} disabled={unread === 0}>
          <CheckCheck className="size-4" />
          Mark all read
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="px-3 py-16 text-center text-sm text-muted-foreground">
          {tab === "unread" ? "No unread notifications." : "You're all caught up."}
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map((n) => {
            const meta = notificationMeta(n.type);
            const href = notificationHref(n.entity, n.entity_id);
            const Icon = meta.icon;
            const inner = (
              <div className={cn("flex items-start gap-3 px-3 py-3", !n.is_read && "bg-primary/5")}>
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", meta.tone)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="truncate text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</p>
                </div>
                {!n.is_read && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </div>
            );
            return (
              <li key={n.id}>
                {href ? (
                  <Link
                    href={href}
                    onClick={() => read(n.id)}
                    className="block outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => read(n.id)}
                    className="block w-full text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
