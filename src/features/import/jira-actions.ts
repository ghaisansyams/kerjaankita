"use server";

import { z } from "zod";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { isJiraConfigured } from "@/lib/env";
import { JiraError, jiraMyself, jiraProjects, jiraSearchIssues } from "@/services/jira/client";
import { mapJiraIssue } from "@/services/jira/map";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { ImportPreviewTask } from "./actions";

/** Same ceiling the document importer uses, so one review screen behaves alike. */
const MAX_ISSUES = 100;

/** Whether the integration has credentials, and who they belong to. */
export async function jiraStatus(): Promise<
  ActionResult<{ enabled: boolean; account: string | null }>
> {
  await requireOrgContext();
  if (!isJiraConfigured) return actionOk({ enabled: false, account: null });
  try {
    const me = await jiraMyself();
    return actionOk({ enabled: true, account: me.emailAddress || me.displayName });
  } catch {
    // Configured but unreachable/rejected — the dialog treats this as disabled
    // and tells the user to check the credentials.
    return actionOk({ enabled: false, account: null });
  }
}

export async function listJiraProjects(): Promise<
  ActionResult<{ key: string; name: string }[]>
> {
  const ctx = await requireOrgContext();
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.TASK_CREATE, {}))) {
    return actionError("FORBIDDEN", "You can't import tasks.");
  }
  if (!isJiraConfigured) return actionError("NOT_CONFIGURED", "Jira isn't connected.");
  try {
    const projects = await jiraProjects();
    return actionOk(projects.map((p) => ({ key: p.key, name: p.name })));
  } catch (e) {
    if (e instanceof JiraError) return actionError("INTERNAL", e.message);
    return mapUnknownError(e);
  }
}

const previewSchema = z.object({
  projectId: z.string().uuid(),
  projectKey: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,20}$/, "That doesn't look like a Jira project key"),
  /** Leave the Done issues behind by default — most migrations only want open work. */
  openOnly: z.boolean().default(false),
});

/**
 * Pull issues for one Jira project and map them for the same review screen the
 * document import uses. Read-only: nothing is written until the user commits.
 */
export async function previewJiraIssues(
  input: unknown,
): Promise<ActionResult<{ tasks: ImportPreviewTask[]; truncated: boolean }>> {
  const ctx = await requireOrgContext();
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { projectId, projectKey, openOnly } = parsed.data;

  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.TASK_CREATE, { projectId }))) {
    return actionError("FORBIDDEN", "You can't import tasks into this project.");
  }
  if (!isJiraConfigured) return actionError("NOT_CONFIGURED", "Jira isn't connected.");

  // projectKey is regex-pinned above, so it can't break out of the JQL string.
  const jql = [
    `project = "${projectKey}"`,
    openOnly ? "AND statusCategory != Done" : "",
    "ORDER BY created ASC",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    // Ask for one extra so we can tell "exactly 100" from "more than 100".
    const issues = await jiraSearchIssues(jql, MAX_ISSUES + 1);
    const truncated = issues.length > MAX_ISSUES;
    const tasks = issues
      .slice(0, MAX_ISSUES)
      .map(mapJiraIssue)
      .filter((t) => t.title.length > 0)
      .map((t) => ({ title: t.title, description: t.description, images: [] }));
    return actionOk({ tasks, truncated });
  } catch (e) {
    if (e instanceof JiraError) return actionError("INTERNAL", e.message);
    return mapUnknownError(e);
  }
}
