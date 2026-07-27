import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { listNotificationPreferences } from "@/repositories/notification.repository";
import { NotificationPreferences } from "@/features/notifications/components/notification-preferences";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  await requireOrgContext();
  const prefs = await listNotificationPreferences();
  const map: Record<string, boolean> = {};
  for (const p of prefs) map[p.type] = p.in_app;

  return (
    <div className="max-w-lg">
      <NotificationPreferences initial={map} />
    </div>
  );
}
