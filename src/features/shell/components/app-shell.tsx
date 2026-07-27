"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ShellContext } from "../types";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function AppShell({
  ctx,
  initialUnread,
  children,
}: {
  ctx: ShellContext;
  initialUnread: number;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar ctx={ctx} />
      <SidebarInset>
        <AppTopbar ctx={ctx} initialUnread={initialUnread} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
