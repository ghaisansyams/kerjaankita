import "server-only";
import type { DocumentParser, ParsedDocument, ParsedTable } from "./types";
import { readCsvRows } from "./csv-rows";

/** Jira exports run ~100 columns wide; the rest is rank/form/timer bookkeeping. */
const JIRA_KEEP = new Set([
  "summary",
  "issue key",
  "issue type",
  "status",
  "priority",
  "assignee",
  "reporter",
  "due date",
  "resolution",
  "description",
  "parent key",
  "parent summary",
  "created",
  "updated",
]);

/**
 * Narrow a Jira export to the columns that carry meaning. Feeding all ~100 to a
 * model wastes most of the context window on ranks and form ids, and the noise
 * measurably degrades what it extracts.
 */
function trimJiraColumns(rows: string[][]): string[][] {
  const head = rows[0].map((c) => c.trim().toLowerCase());
  if (!(head.includes("issue key") && head.includes("summary"))) return rows;

  // First match only: Jira repeats headers (Attachment, Comment, …).
  const keep: number[] = [];
  const seen = new Set<string>();
  head.forEach((h, i) => {
    if (JIRA_KEEP.has(h) && !seen.has(h)) {
      seen.add(h);
      keep.push(i);
    }
  });
  return rows.map((row) => keep.map((i) => row[i] ?? ""));
}

/**
 * CSV → a single [TABLE 0] plus a text rendering of the same grid. Delimited
 * data is already tabular, so the table carries the structure and the text is
 * there for models that reason better over prose.
 */
export class CsvParser implements DocumentParser {
  readonly kind = "csv";

  supports(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".csv");
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const rows = trimJiraColumns(readCsvRows(buffer));
    if (!rows.length) return { kind: "csv", text: "", images: [], tables: [] };

    const tables: ParsedTable[] = [{ index: 0, rows }];
    const lines = ["[TABLE 0]"];
    for (const row of rows) {
      const text = row.map((c) => c.trim()).filter(Boolean).join(" | ");
      if (text) lines.push(`- ${text}`);
    }

    return { kind: "csv", text: lines.join("\n"), images: [], tables };
  }
}
