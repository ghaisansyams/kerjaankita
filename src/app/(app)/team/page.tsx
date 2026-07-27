import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requirePermission(PERMISSIONS.ORG_MEMBER_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Members, roles, and workload across the organization."
      />
      <ComingSoon title="Team" />
    </div>
  );
}
