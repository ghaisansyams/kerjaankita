"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ShellContext } from "../types";
import { CommandMenu } from "./command-menu";
import { NotificationsMenu } from "./notifications-menu";

export function AppTopbar({
  ctx,
  initialUnread,
}: {
  ctx: ShellContext;
  initialUnread: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <div className="flex flex-1 items-center">
        <CommandMenu ctx={ctx} />
      </div>
      <div className="flex items-center gap-0.5">
        <NotificationsMenu initialUnread={initialUnread} />
        <ThemeToggle />
      </div>
    </header>
  );
}
