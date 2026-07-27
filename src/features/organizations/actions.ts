"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ACTIVE_ORG_COOKIE } from "@/constants";
import { slugify } from "@/utils/format";
import { createOrganizationSchema } from "./schema";

export type OrgActionState = { error?: string } | undefined;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** Switch the active organization (validated against real membership). */
export async function setActiveOrganization(organizationId: string) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // RLS would hide foreign organizations anyway; this makes the intent explicit.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!membership) redirect("/dashboard");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, COOKIE_OPTIONS);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Create the caller's organization and make it active.
 * The heavy lifting (settings, default workspace, industry-specific workflow,
 * owner membership) happens atomically inside bootstrap_organization().
 */
export async function createOrganization(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    industryKey: formData.get("industryKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bootstrap_organization", {
    p_name: parsed.data.name,
    p_slug: slugify(parsed.data.name) || "workspace",
    p_owner: user.id,
    p_industry_key: parsed.data.industryKey,
  });

  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, data as string, COOKIE_OPTIONS);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
