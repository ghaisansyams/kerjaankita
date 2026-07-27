import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Health tolerance for BR-5 (falls back to the seeded default of 15). */
export async function getHealthTolerance(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_settings")
    .select("health_tolerance_points")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data?.health_tolerance_points ?? 15;
}
