"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ canManageWorkspace }: { canManageWorkspace: boolean }) {
  const pathname = usePathname();
  const items = [
    { label: "Profile", href: "/settings/profile" },
    { label: "Appearance", href: "/settings/appearance" },
    { label: "Security", href: "/settings/security" },
    { label: "Notifications", href: "/settings/notifications" },
    ...(canManageWorkspace ? [{ label: "Workspace", href: "/settings/workspace" }] : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Settings sections">
      {items.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
