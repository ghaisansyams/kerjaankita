import type { Metadata } from "next";
import { requireInternal } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage() {
  await requireInternal();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks"
        description="What you should do today, tomorrow, and what's overdue."
      />
      <ComingSoon title="My Tasks" />
    </div>
  );
}
