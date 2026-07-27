"use client";

import Link from "next/link";
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "@/features/auth/actions";
import { setActiveOrganization } from "@/features/organizations/actions";
import { getInitials } from "@/utils/format";
import { PERMISSIONS } from "@/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ShellContext } from "../types";

export function NavUser({ ctx }: { ctx: ShellContext }) {
  const { isMobile } = useSidebar();
  const { setTheme, resolvedTheme } = useTheme();
  const { user, org, orgs, roleName, permissions } = ctx;
  const canManageSettings = permissions.includes(PERMISSIONS.ORG_SETTINGS_UPDATE);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="rounded-lg">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleName}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                  <AvatarFallback className="rounded-lg">
                    {getInitials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {orgs.map((o) => (
                <form key={o.id} action={setActiveOrganization.bind(null, o.id)}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full cursor-pointer">
                      <span className="truncate">{o.name}</span>
                      {o.id === org.id && <Check className="ml-auto size-4" />}
                    </button>
                  </DropdownMenuItem>
                </form>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/onboarding">
                  <Plus />
                  New organization
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <UserRound />
                  Profile
                </Link>
              </DropdownMenuItem>
              {canManageSettings && (
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Organization settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                }}
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                Toggle theme
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer">
                  <LogOut />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
