import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { getMomFilterOptions, listMoms } from "@/repositories/mom.repository";
import { MomList } from "@/features/mom/components/mom-list";

export default async function ProjectMomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const [moms, options, canCreate] = await Promise.all([
    listMoms(ctx.organization.id, { projectId: id }),
    getMomFilterOptions(ctx.organization.id),
    checkPermission(ctx.organization.id, PERMISSIONS.MOM_CREATE, { projectId: id }),
  ]);

  return (
    <div className="pt-4">
      <MomList moms={moms} options={options} canCreate={canCreate} projectId={id} />
    </div>
  );
}
