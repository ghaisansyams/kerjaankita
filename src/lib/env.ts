/**
 * Centralised environment access.
 *
 * Neon PostgreSQL + Prisma + NextAuth environment configuration.
 */

export const DATABASE_URL =
  process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const isDatabaseConfigured = Boolean(DATABASE_URL);
// Alias for backward compatibility during migration
export const isSupabaseConfigured = isDatabaseConfigured;

/* -------------------------------------------------------------------------- */
/*  Jira (server-only). Basic auth needs the account email AND its API token —  */
/*  a token on its own can't identify a caller, so all three must be present.  */
/* -------------------------------------------------------------------------- */

export const JIRA_BASE_URL = (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, "");
export const JIRA_EMAIL = process.env.JIRA_EMAIL ?? "";
/** Server-only. Never import this into a client component. */
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? "";

export const isJiraConfigured = Boolean(JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN);

export function assertDatabaseConfigured(): void {
  if (!isDatabaseConfigured) {
    throw new Error(
      "Database is not configured. Please set DATABASE_URL in .env.local",
    );
  }
}
export const assertSupabaseConfigured = assertDatabaseConfigured;
