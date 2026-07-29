import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { getMom, getOrgBranding } from "@/repositories/mom.repository";
import { MomPrintDocument } from "@/features/mom/components/mom-print-document";
import { PrintTrigger } from "@/features/mom/components/print-trigger";

export const metadata = { title: "MOM — Export" };

export default async function MomPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const mom = await getMom(id);
  if (!mom) notFound();
  const branding = await getOrgBranding(ctx.organization.id);

  return (
    <>
      <PrintTrigger />
      <MomPrintDocument mom={mom} orgName={branding.name} logoUrl={branding.logoUrl} />
    </>
  );
}
