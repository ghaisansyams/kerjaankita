import {
  LayoutDashboard,
  FolderKanban,
  GanttChart,
  CalendarDays,
  BarChart3,
  PieChart,
  Bell,
  Building2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type PermissionKey } from "@/constants";

/**
 * Navigation is driven by PERMISSIONS, not by role names. A tenant can invent
 * a custom role called "Delivery Chief" and the sidebar adapts automatically,
 * because items ask "may you do X?" rather than "are you a Y?".
 */
export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Required permission. Omit for items everyone may see. */
  permission?: PermissionKey;
  /** Hide from guests (external collaborators). */
  internalOnly?: boolean;
  exact?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// NOTE: My Tasks, Files and Team are intentionally omitted — their pages are
// placeholders in v1.0, so they are not linked from navigation to avoid routing
// users to unfinished screens (QA RC1 · H1). The routes still exist; they are
// simply not surfaced. Clients is a real feature and IS surfaced (below).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { title: "Projects", href: "/projects", icon: FolderKanban },
      { title: "Timeline", href: "/timeline", icon: GanttChart, internalOnly: true },
      { title: "Calendar", href: "/calendar", icon: CalendarDays, internalOnly: true },
      { title: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart3, permission: PERMISSIONS.REPORT_VIEW },
      { title: "Analytics", href: "/analytics", icon: PieChart, permission: PERMISSIONS.REPORT_VIEW },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Clients", href: "/clients", icon: Building2, permission: PERMISSIONS.ACCOUNT_MANAGE, internalOnly: true },
      { title: "Settings", href: "/settings", icon: Settings, permission: PERMISSIONS.ORG_SETTINGS_UPDATE },
    ],
  },
];

/** Nav groups visible given a permission set (empty groups are dropped). */
export function navFor(permissions: string[], isGuest: boolean): NavGroup[] {
  const granted = new Set(permissions);
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (i.internalOnly && isGuest) return false;
      if (i.permission && !granted.has(i.permission)) return false;
      return true;
    }),
  })).filter((g) => g.items.length > 0);
}
