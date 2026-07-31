import "server-only";
import type { ParsedDocument } from "./parsers";

// PASS 1 — extract only the TOP-LEVEL structure (areas + Hak Akses). The heavy
// per-area detail (sub-modules + CRUD leaves) is expanded separately in pass 2,
// which keeps each request small enough for the model to be exhaustive.
export function buildImportSystemPrompt(): string {
  return [
    "You are an expert software business analyst. You read a spec or a role → module",
    "→ feature FLOWCHART and extract only its TOP-LEVEL STRUCTURE (details are",
    "expanded in a later step).",
    "",
    "Produce:",
    "  1. Roadmap — a few high-level tracks (e.g. 'Autentikasi & Dashboard', 'Manajemen",
    "               User', 'Master Data & Setting', 'Booking & Meeting', 'Laporan &",
    "               Log'), or a single 'Delivery' roadmap.",
    "  2. Module  — a functional group of related areas inside a roadmap.",
    "  3. Feature — each MAJOR area / TOP box becomes exactly ONE board task, e.g.",
    "               'Login/Logout', 'Dashboard', 'Management User', 'Management Master",
    "               Data', 'Setting', 'Booking Room', 'Report & Log'.",
    "",
    "For EVERY feature, set `roles` = the HAK AKSES: each role whose section contains",
    "that area, WITH its platform in parentheses — e.g. 'Super Admin (WEB)', 'Admin",
    "Client (WEB)', 'Secretary Client (WEB & APP)', 'Employee (APP)', 'Guest (WEB)'.",
    "If the same area appears under several roles, keep ONE feature and list ALL of",
    "those roles in `roles`.",
    "",
    "Leave `checklist` EMPTY — the sub-modules and their actions are added later.",
    "",
    "Rules:",
    "- Use the document's OWN labels verbatim for area names — never invent generic",
    "  names like 'Create User' or 'Manage X'.",
    "- Scan EVERY role's pages so no area is missed; dedupe an area that repeats across",
    "  roles into ONE feature (collecting all its roles).",
    "- Also fill top-level `roles` with the full list of distinct roles found.",
    "- Confidence per level; never invent content.",
  ].join("\n");
}

// PASS 2 — expand ONE area into a COMPLETE nested checklist.
export function buildExpandSystemPrompt(): string {
  return [
    "You expand ONE area of a software-spec flowchart into a COMPLETE nested checklist.",
    "",
    "- The area's sub-modules are the SECOND-row boxes under it. EACH sub-module becomes",
    "  one checklist item.",
    "- Under each sub-module, list ALL of its leaf actions (the WHITE boxes: List,",
    "  Detail, Add, Edit, Delete, Import, Download, Preview, Setting, Send…, Order…,",
    "  Activate…, etc.) as `children`, copied verbatim.",
    "- If a sub-module is itself a leaf (nothing beneath it), return it as an item with",
    "  an empty `children` list. Do NOT invent children that aren't in the document.",
    "- Include EVERY sub-module and EVERY leaf for this area — do not stop early or",
    "  summarise. If the area repeats across roles with the same sub-modules, list once.",
  ].join("\n");
}

export function buildExpandUserPrompt(areaName: string, docText: string): string {
  const body = docText ? `\n\nDOCUMENT:\n${compactText(docText).slice(0, 120_000)}` : "";
  return (
    `Expand the area "${areaName}" COMPLETELY from the document below. ` +
    `List every sub-module of "${areaName}" as a checklist item, and every leaf ` +
    `action under each sub-module as its children.` +
    body
  );
}

export function buildImportUserPrompt(parsed: ParsedDocument): string {
  const head = [
    `Document type: ${parsed.kind.toUpperCase()}${parsed.pageCount ? ` (${parsed.pageCount} pages)` : ""}.`,
    `Embedded images: ${parsed.images.length}. Tables: ${parsed.tables.length}.`,
    parsed.pdfBase64
      ? "The full PDF is attached — read its visual layout (boxes, arrows, tables, diagrams), not only the text."
      : "",
    "Analyse the content and call the tool with the structured hierarchy.",
  ]
    .filter(Boolean)
    .join("\n");

  const tableDump = parsed.tables.length
    ? "\n\nTABLES:\n" +
      parsed.tables
        .map((t) => `[TABLE ${t.index}]\n` + t.rows.map((r) => r.join(" | ")).join("\n"))
        .join("\n\n")
    : "";

  // For DOCX we pass the extracted text; for PDF the text is a hint (the PDF
  // bytes are attached separately for vision). Flowchart/role-matrix PDFs repeat
  // the same modules across every role, which inflates the token count enormously
  // (the whole reason a free-tier request can blow past its per-minute limit), so
  // we collapse exact-duplicate lines first. The prompt already asks the model to
  // dedupe across roles, so no unique information is lost.
  const body = parsed.text ? `\n\nDOCUMENT TEXT:\n${compactText(parsed.text).slice(0, 120_000)}` : "";

  return head + tableDump + body;
}

/**
 * Squeeze repetition out of extracted document text: trim each line, drop exact
 * duplicates (keeping first occurrence and its order), and collapse blank runs.
 * Highly repetitive specs (role-access matrices) shrink dramatically; already-
 * unique prose is left essentially untouched.
 */
export function compactText(raw: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  let blank = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replace(/[ \t]+/g, " ").trim();
    if (!trimmed) {
      if (blank === 0 && out.length) out.push("");
      blank++;
      continue;
    }
    blank = 0;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.join("\n").trim();
}
