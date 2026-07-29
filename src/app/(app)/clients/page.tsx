import type { Metadata } from "next";
import { requireOrgContext, requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { listClientAccounts } from "@/repositories/account.repository";
import { PageHeader } from "@/components/page-header";
import { ClientsManager } from "@/features/clients/components/clients-manager";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requirePermission(PERMISSIONS.ACCOUNT_MANAGE);
  const ctx = await requireOrgContext();
  const [accounts, canInvite] = await Promise.all([
    listClientAccounts(ctx.organization.id),
    checkPermission(ctx.organization.id, PERMISSIONS.ORG_MEMBER_MANAGE),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Client organizations and their read-only portal access."
      />
      <ClientsManager accounts={accounts} canInvite={canInvite} />
    </div>
  );
}
