import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { getMom, getMomFilterOptions } from "@/repositories/mom.repository";
import { MomDetail } from "@/features/mom/components/mom-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mom = await getMom(id);
  return { title: mom ? mom.title : "MOM" };
}

export default async function MomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const mom = await getMom(id);
  if (!mom) notFound();

  const [canEdit, canDelete, canExport, options] = await Promise.all([
    checkPermission(ctx.organization.id, PERMISSIONS.MOM_UPDATE, { projectId: mom.projectId }),
    checkPermission(ctx.organization.id, PERMISSIONS.MOM_DELETE, { projectId: mom.projectId }),
    checkPermission(ctx.organization.id, PERMISSIONS.MOM_EXPORT, { projectId: mom.projectId }),
    getMomFilterOptions(ctx.organization.id),
  ]);

  return (
    <MomDetail
      mom={mom}
      members={options.members}
      canEdit={canEdit}
      canDelete={canDelete}
      canExport={canExport}
      canCreateTask={canEdit}
    />
  );
}
