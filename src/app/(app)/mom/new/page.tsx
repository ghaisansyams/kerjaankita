import type { Metadata } from "next";
import { requireOrgContext, requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { getMomFilterOptions } from "@/repositories/mom.repository";
import { PageHeader } from "@/components/page-header";
import { MomForm } from "@/features/mom/components/mom-form";

export const metadata: Metadata = { title: "New MOM" };

export default async function NewMomPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  await requirePermission(PERMISSIONS.MOM_CREATE);
  const ctx = await requireOrgContext();
  const { project } = await searchParams;
  const options = await getMomFilterOptions(ctx.organization.id);

  return (
    <div className="space-y-6">
      <PageHeader title="New meeting minutes" description="Write it once — FlowDesk stores it, links it to the project, and exports a PDF." />
      <MomForm mode="create" projects={options.projects} members={options.members} initial={{ projectId: project ?? "" }} />
    </div>
  );
}
