import { can, requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/features/settings/components/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();
  const canManageWorkspace =
    can(ctx, PERMISSIONS.ORG_SETTINGS_UPDATE) || can(ctx, PERMISSIONS.ORG_MEMBER_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and workspace." />
      <SettingsNav canManageWorkspace={canManageWorkspace} />
      {children}
    </div>
  );
}
