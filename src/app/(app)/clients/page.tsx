import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requirePermission(PERMISSIONS.ACCOUNT_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Client organizations, contacts, and their portal access."
      />
      <ComingSoon title="Clients" />
    </div>
  );
}
