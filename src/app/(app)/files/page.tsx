import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Files" };

export default function FilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Files"
        description="Every document, screenshot, and deliverable in one place."
      />
      <ComingSoon title="Files" />
    </div>
  );
}
