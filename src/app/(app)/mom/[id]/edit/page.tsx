import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { getMom, getMomFilterOptions } from "@/repositories/mom.repository";
import { PageHeader } from "@/components/page-header";
import { MomForm } from "@/features/mom/components/mom-form";

export const metadata: Metadata = { title: "Edit MOM" };

export default async function EditMomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const mom = await getMom(id);
  if (!mom) notFound();
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.MOM_UPDATE, { projectId: mom.projectId }))) redirect(`/mom/${id}`);

  const options = await getMomFilterOptions(ctx.organization.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Edit meeting minutes" />
      <MomForm
        mode="edit"
        momId={mom.id}
        projects={options.projects}
        members={options.members}
        initial={{
          projectId: mom.projectId,
          title: mom.title,
          meetingDate: mom.meetingDate,
          meetingTime: mom.meetingTime ?? "",
          location: mom.location ?? "",
          picId: mom.picId ?? "",
          approvedByName: mom.approvedByName,
          approvedByRole: mom.approvedByRole,
          participants: mom.participants.map((p) => ({ name: p.name, role: p.role ?? "", company: p.company ?? "" })),
          distribution: mom.distribution.map((d) => d.recipient),
          notes: mom.notes.map((n) => ({ id: n.id, category: n.category, content: n.content })),
        }}
      />
    </div>
  );
}
