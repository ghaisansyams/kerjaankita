import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import {
  listNotificationPreferences,
  listNotifications,
} from "@/repositories/notification.repository";
import { PageHeader } from "@/components/page-header";
import {
  NotificationCenter,
  type NotificationVM,
} from "@/features/notifications/components/notification-center";
import { NotificationPreferences } from "@/features/notifications/components/notification-preferences";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireOrgContext();

  const [rows, prefs] = await Promise.all([
    listNotifications(50),
    listNotificationPreferences(),
  ]);

  const items: NotificationVM[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    entity: r.entity,
    entity_id: r.entity_id,
    is_read: r.is_read,
    created_at: r.created_at,
  }));

  const prefMap: Record<string, boolean> = {};
  for (const p of prefs) prefMap[p.type] = p.in_app;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Everything that needs your attention." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <NotificationCenter userId={ctx.profile.id} initialItems={items} />
        <NotificationPreferences initial={prefMap} />
      </div>
    </div>
  );
}
