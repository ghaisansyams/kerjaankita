import "server-only";
import { JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_EMAIL, isJiraConfigured } from "@/lib/env";

export type JiraProject = { id: string; key: string; name: string };

/** Only the fields we actually map. Asking for everything makes Jira slow. */
export const ISSUE_FIELDS = [
  "summary",
  "description",
  "issuetype",
  "status",
  "priority",
  "assignee",
  "reporter",
  "duedate",
  "resolution",
  "parent",
] as const;

export type JiraIssue = {
  key: string;
  fields: Record<string, unknown>;
};

export class JiraError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function authHeader(): string {
  // Jira Cloud API tokens authenticate as Basic base64(email:token).
  return `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`;
}

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isJiraConfigured) throw new JiraError("Jira is not configured.", 0);

  const res = await fetch(`${JIRA_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 401/403 is nearly always a stale token or the wrong account email, so say
    // that rather than surfacing Atlassian's HTML error page.
    const hint =
      res.status === 401 || res.status === 403
        ? "Jira rejected the credentials — check JIRA_EMAIL matches the account that owns JIRA_API_TOKEN."
        : body.slice(0, 300);
    throw new JiraError(hint || `Jira returned ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/** Who the token belongs to — the cheapest way to prove the wiring works. */
export async function jiraMyself(): Promise<{ accountId: string; displayName: string; emailAddress?: string }> {
  return jiraFetch("/rest/api/3/myself");
}

export async function jiraProjects(): Promise<JiraProject[]> {
  const page = await jiraFetch<{ values: JiraProject[] }>(
    "/rest/api/3/project/search?maxResults=100&orderBy=key",
  );
  return (page.values ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

type JqlPage = {
  issues?: JiraIssue[];
  nextPageToken?: string;
  startAt?: number;
  total?: number;
  isLast?: boolean;
};

/**
 * Run a JQL search, following pagination until `limit` is reached.
 *
 * Atlassian is mid-migration from GET /search (startAt paging) to
 * POST /search/jql (token paging). Which one a site serves depends on when it
 * was provisioned, so try the new shape first and fall back on 404/410 rather
 * than guessing.
 */
export async function jiraSearchIssues(jql: string, limit: number): Promise<JiraIssue[]> {
  try {
    return await searchViaJqlEndpoint(jql, limit);
  } catch (e) {
    if (e instanceof JiraError && (e.status === 404 || e.status === 410)) {
      return searchViaLegacyEndpoint(jql, limit);
    }
    throw e;
  }
}

async function searchViaJqlEndpoint(jql: string, limit: number): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const page = await jiraFetch<JqlPage>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql,
        fields: ISSUE_FIELDS,
        maxResults: Math.min(100, limit - issues.length),
        ...(nextPageToken ? { nextPageToken } : {}),
      }),
    });
    issues.push(...(page.issues ?? []));
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && issues.length < limit);

  return issues.slice(0, limit);
}

async function searchViaLegacyEndpoint(jql: string, limit: number): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let startAt = 0;

  for (;;) {
    const page = await jiraFetch<JqlPage>("/rest/api/3/search", {
      method: "POST",
      body: JSON.stringify({
        jql,
        fields: ISSUE_FIELDS,
        startAt,
        maxResults: Math.min(100, limit - issues.length),
      }),
    });
    const batch = page.issues ?? [];
    issues.push(...batch);
    startAt += batch.length;
    if (!batch.length || issues.length >= limit || startAt >= (page.total ?? 0)) break;
  }

  return issues.slice(0, limit);
}
