import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { getMomFilterOptions, listMoms } from "@/repositories/mom.repository";
import { PageHeader } from "@/components/page-header";
import { MomList } from "@/features/mom/components/mom-list";

export const metadata: Metadata = { title: "MOM" };

export default async function MomPage() {
  const ctx = await requireOrgContext();
  const [moms, options, canCreate] = await Promise.all([
    listMoms(ctx.organization.id),
    getMomFilterOptions(ctx.organization.id),
    checkPermission(ctx.organization.id, PERMISSIONS.MOM_CREATE),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Minutes of Meeting" description="Every meeting, documented and linked to its project." />
      <MomList moms={moms} options={options} canCreate={canCreate} />
    </div>
  );
}
