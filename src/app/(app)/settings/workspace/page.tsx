import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can, requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { getWorkspace, listWorkspaces } from "@/repositories/workspace.repository";
import { listTaskWorkflows } from "@/repositories/workflow.repository";
import { listRoles } from "@/repositories/role.repository";
import { listAccountOptions } from "@/repositories/account.repository";
import { listInvitations } from "@/repositories/invitation.repository";
import { listGuests } from "@/repositories/member.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "@/features/workspace/components/workspace-form";
import { WorkspaceSwitcher } from "@/features/workspace/components/workspace-switcher";
import { DangerZone } from "@/features/workspace/components/danger-zone";
import { InvitationsManager } from "@/features/workspace/components/invitations-manager";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws: wsParam } = await searchParams;
  const ctx = await requireOrgContext();
  const canSettings = can(ctx, PERMISSIONS.ORG_SETTINGS_UPDATE);
  const canMembers = can(ctx, PERMISSIONS.ORG_MEMBER_MANAGE);
  if (!canSettings && !canMembers) redirect("/settings/profile");
  const orgId = ctx.organization.id;

  const workspaces = await listWorkspaces(orgId);
  const defaultWs = workspaces.find((w) => w.is_default) ?? workspaces[0];
  const selectedId = workspaces.find((w) => w.id === wsParam)?.id ?? defaultWs?.id;

  const [ws, workflows, roles, accounts, invitations, guests] = await Promise.all([
    selectedId ? getWorkspace(selectedId) : Promise.resolve(null),
    listTaskWorkflows(orgId),
    listRoles(orgId, "organization"),
    listAccountOptions(orgId),
    canMembers ? listInvitations(orgId) : Promise.resolve([]),
    canMembers ? listGuests(orgId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      {canSettings && workspaces.length > 1 && ws && (
        <WorkspaceSwitcher
          workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
          current={ws.id}
        />
      )}

      {canSettings && ws && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Workspace & branding</h2>
          <WorkspaceForm
            workspaceId={ws.id}
            orgId={orgId}
            logoUrl={ws.logo_url}
            initial={{
              name: ws.name,
              description: ws.description ?? "",
              color: ws.color,
              defaultWorkflowId: ws.default_workflow_id ?? "none",
            }}
            workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
          />
        </section>
      )}

      {canSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
            <p className="text-sm text-muted-foreground">
              Roles available when inviting people to this organization.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {roles.map((r) => (
                <li key={r.id} className="py-2">
                  <p className="text-sm font-medium">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {canMembers && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Members & guests</h2>
          <InvitationsManager
            roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            invitations={invitations.map((i) => ({
              id: i.id,
              email: i.email,
              memberType: i.member_type,
              status: i.status,
              expiresAt: i.expires_at,
              token: i.token,
              roleName: i.role?.name ?? null,
              accountName: i.account?.name ?? null,
            }))}
            guests={guests.map((g) => ({
              id: g.user_id,
              name: g.profile?.full_name ?? g.profile?.email ?? "Guest",
              email: g.profile?.email ?? null,
              accountName: g.account?.name ?? null,
            }))}
          />
        </section>
      )}

      {canSettings && ws && (
        <DangerZone workspaceId={ws.id} workspaceName={ws.name} isDefault={ws.is_default} />
      )}
    </div>
  );
}
