"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/repositories/notification.repository";
import { notificationHref, notificationMeta } from "@/features/notifications/constants";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/features/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function NotificationsMenu({ initialUnread }: { initialUnread: number }) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      return (await fetchNotifications(15)) as NotificationRow[];
    },
    refetchInterval: 15_000,
  });

  const notifications = data ?? [];
  const unread = data
    ? notifications.filter((n) => !n.is_read).length
    : initialUnread;

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await markNotificationRead({ id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await markAllNotificationsRead();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-[380px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const meta = notificationMeta(n.type);
                const Icon = meta.icon;
                const href = notificationHref(n.entity, n.entity_id);

                const itemContent = (
                  <div
                    className={cn(
                      "flex gap-3 p-4 transition-colors hover:bg-muted/50 cursor-pointer",
                      !n.is_read && "bg-muted/20",
                    )}
                    onClick={() => {
                      if (!n.is_read) markOne.mutate(n.id);
                    }}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        meta.tone,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-xs leading-none",
                            !n.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                    </div>
                    {!n.is_read && (
                      <div className="flex shrink-0 items-center">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                );

                return href ? (
                  <Link key={n.id} href={href} className="block">
                    {itemContent}
                  </Link>
                ) : (
                  <div key={n.id}>{itemContent}</div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2 text-center">
          <Link
            href="/notifications"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
