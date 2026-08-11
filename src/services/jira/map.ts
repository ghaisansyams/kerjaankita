import "server-only";
import type { JiraIssue } from "./client";

export type JiraMappedTask = { title: string; description: string; images: never[] };

type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
};

/**
 * Jira's REST v3 returns descriptions as Atlassian Document Format — a JSON
 * tree, not text. Walk it and keep the readable parts; anything exotic (media,
 * panels, macros) contributes its child text rather than a placeholder.
 */
function adfToText(node: unknown, depth = 0): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map((n) => adfToText(n, depth)).join("");

  const n = node as AdfNode;
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  if (n.type === "mention") return String(n.attrs?.text ?? "");
  if (n.type === "emoji") return String(n.attrs?.shortName ?? "");
  if (n.type === "inlineCard" || n.type === "blockCard") return String(n.attrs?.url ?? "");

  const inner = adfToText(n.content ?? [], depth + 1);
  switch (n.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
    case "codeBlock":
      return inner ? `${inner}\n` : "";
    case "listItem":
      return inner ? `- ${inner.trimEnd()}\n` : "";
    case "bulletList":
    case "orderedList":
      return inner;
    case "rule":
      return "\n";
    default:
      return inner;
  }
}

/** Nested field lookup that tolerates Jira's many null shapes. */
const str = (v: unknown, key?: string): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (key && typeof v === "object") return str((v as Record<string, unknown>)[key]);
  return "";
};

/**
 * Issue → task, mirroring the CSV importer so both routes produce the same
 * shape: Summary is the title, the description carries the body plus one
 * trailing line of the fields that still mean something outside Jira.
 */
export function mapJiraIssue(issue: JiraIssue): JiraMappedTask {
  const f = issue.fields ?? {};
  const title = str(f.summary);

  const parts: string[] = [];
  const body = adfToText(f.description).trim();
  if (body) parts.push(body);

  const parent = f.parent as { key?: string; fields?: { summary?: string } } | undefined;
  if (parent?.key) {
    parts.push(`Parent: ${[parent.key, parent.fields?.summary].filter(Boolean).join(" ")}`);
  }

  const tags = [
    ["Jira", issue.key],
    ["Tipe", str(f.issuetype, "name")],
    ["Status", str(f.status, "name")],
    ["Prioritas", str(f.priority, "name")],
    ["PIC", str(f.assignee, "displayName")],
    ["Due", str(f.duedate)],
    ["Resolusi", str(f.resolution, "name")],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  if (tags.length) parts.push(tags.join(" · "));

  return {
    title: title.slice(0, 200),
    description: parts.join("\n\n").slice(0, 5000),
    images: [],
  };
}
