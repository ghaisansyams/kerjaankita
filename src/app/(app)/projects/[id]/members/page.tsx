import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { loadProject } from "@/features/projects/loaders";
import { checkPermission } from "@/repositories/permission.repository";
import { listProjectMembers } from "@/repositories/project-member.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { listRoles } from "@/repositories/role.repository";
import { MembersPanel } from "@/features/project-members/components/members-panel";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const project = await loadProject(id);
  if (!project) notFound();

  const canManage = await checkPermission(
    ctx.organization.id,
    PERMISSIONS.PROJECT_MEMBER_MANAGE,
    { projectId: id },
  );

  const rows = await listProjectMembers(id);
  const members = rows.map((r) => ({
    id: r.id,
    name: r.profile?.full_name ?? r.profile?.email ?? "Member",
    email: r.profile?.email ?? null,
    avatarUrl: r.profile?.avatar_url ?? null,
    roleId: r.role_id,
    roleName: r.role?.name ?? null,
  }));

  let candidates: { id: string; name: string }[] = [];
  let roles: { id: string; name: string }[] = [];
  if (canManage) {
    const [profiles, roleList] = await Promise.all([
      listOrgMemberProfiles(ctx.organization.id),
      listRoles(ctx.organization.id, "project"),
    ]);
    const existing = new Set(rows.map((r) => r.user_id));
    candidates = profiles
      .filter((p) => !existing.has(p.id))
      .map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Member" }));
    roles = roleList.map((r) => ({ id: r.id, name: r.name }));
  }

  return (
    <MembersPanel
      projectId={id}
      members={members}
      candidates={candidates}
      roles={roles}
      canManage={canManage}
    />
  );
}
