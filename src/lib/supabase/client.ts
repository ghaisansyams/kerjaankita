import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Supabase client for use in Client Components / browser code.
 * Safe to call on every render — the underlying client is memoised internally.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
