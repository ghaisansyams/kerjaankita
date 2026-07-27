"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database.types";
import { notificationHref, notificationMeta } from "@/features/notifications/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Notification = Tables<"notifications">;

export function NotificationsMenu({ initialUnread }: { initialUnread: number }) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      return (data ?? []) as Notification[];
    },
    refetchInterval: 60_000,
  });

  const notifications = data ?? [];
  const unread = data
    ? notifications.filter((n) => !n.is_read).length
    : initialUnread;

  // Realtime: refresh the bell as notifications arrive (RLS delivers only ours).
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const meta = notificationMeta(n.type);
                const href = notificationHref(n.entity, n.entity_id);
                const Icon = meta.icon;
                const body = (
                  <div className={cn("flex items-start gap-2 px-3 py-2.5", !n.is_read && "bg-primary/5")}>
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", meta.tone)}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatRelative(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link href={href} onClick={() => markOne.mutate(n.id)} className="block hover:bg-muted/50">
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markOne.mutate(n.id)}
                        className="block w-full text-left hover:bg-muted/50"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <Link
          href="/notifications"
          className="block px-3 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
