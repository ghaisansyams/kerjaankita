/**
 * Centralised environment access.
 *
 * These are read lazily so the app still boots (and `next build` succeeds)
 * before Supabase credentials are wired up. Anything that actually talks to
 * Supabase should check `isSupabaseConfigured` first, or will throw a clear
 * error at call time rather than at import time.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Server-only. Never import this into a client component. */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* -------------------------------------------------------------------------- */
/*  Jira (server-only). Basic auth needs the account email AND its API token —  */
/*  a token on its own can't identify a caller, so all three must be present.  */
/* -------------------------------------------------------------------------- */

export const JIRA_BASE_URL = (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, "");
export const JIRA_EMAIL = process.env.JIRA_EMAIL ?? "";
/** Server-only. Never import this into a client component. */
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? "";

export const isJiraConfigured = Boolean(JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN);

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Copy .env.local.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}
