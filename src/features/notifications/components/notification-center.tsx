"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils/format";
import { markAllNotificationsRead, markNotificationRead, fetchNotifications } from "../actions";
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
  initialItems,
}: {
  userId?: string;
  initialItems: NotificationVM[];
}) {
  const [items, setItems] = useState<NotificationVM[]>(initialItems);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [, startTransition] = useTransition();

  useEffect(() => setItems(initialItems), [initialItems]);

  // Polling for live notification updates
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        try {
          const fresh = (await fetchNotifications(50)) as NotificationVM[];
          setItems(fresh);
        } catch {
          // ignore transient poll error
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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
                tab === t ? "bg-muted font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t} {t === "unread" && unread > 0 ? `(${unread})` : ""}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <Button size="sm" variant="ghost" onClick={readAll}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          {tab === "unread" ? "No unread notifications." : "No notifications yet."}
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map((n) => {
            const meta = notificationMeta(n.type);
            const Icon = meta.icon;
            const href = notificationHref(n.entity, n.entity_id);

            const row = (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors hover:bg-muted/50",
                  !n.is_read && "bg-muted/30",
                )}
              >
                <div className={cn("mt-0.5 rounded-md p-1.5", meta.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                </div>
                {!n.is_read && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      read(n.id);
                    }}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    title="Mark read"
                  >
                    ●
                  </button>
                )}
              </li>
            );

            return href ? (
              <Link key={n.id} href={href} onClick={() => read(n.id)}>
                {row}
              </Link>
            ) : (
              row
            );
          })}
        </ul>
      )}
    </div>
  );
}
