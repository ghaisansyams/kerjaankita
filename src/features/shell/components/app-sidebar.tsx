"use client";

import Link from "next/link";
import { Logo } from "@/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { navFor } from "../nav-config";
import type { ShellContext } from "../types";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({ ctx }: { ctx: ShellContext }) {
  const groups = navFor(ctx.permissions, ctx.isGuest);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2 px-1.5 py-1.5">
          <Logo className="size-7 shrink-0" />
          <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            {ctx.org.name}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser ctx={ctx} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
