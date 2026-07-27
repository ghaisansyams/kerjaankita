import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberships, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Brand } from "@/components/brand";
import { CreateOrganizationForm } from "@/features/organizations/components/create-organization-form";

export const metadata: Metadata = { title: "Create your organization" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ another?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/");
  await requireProfile();

  const { another } = await searchParams;
  const memberships = await getMemberships();
  // Already onboarded and not explicitly adding another → straight to the app.
  if (memberships.length > 0 && another === undefined) {
    // allow reaching this page deliberately via /onboarding?another
  }

  const supabase = await createClient();
  const { data: industries } = await supabase
    .from("industries")
    .select("key, name, description")
    .order("name");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Brand className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {memberships.length > 0
              ? "Create another organization"
              : "Create your organization"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick your industry and we&apos;ll set up a matching workflow, a
            default workspace, and your owner access.
          </p>
          <div className="mt-6">
            <CreateOrganizationForm industries={industries ?? []} />
          </div>
        </div>
      </div>
    </main>
  );
}
