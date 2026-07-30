import "server-only";
import type { ParsedDocument } from "./parsers";

export function buildImportSystemPrompt(): string {
  return [
    "You are an expert software business analyst. You read a software specification",
    "document (SRS, feature/functional spec, project scope, client requirements,",
    "meeting minutes, or a progress report) and reverse-engineer its structure into",
    "a clean project plan.",
    "",
    "Produce a 4-level hierarchy:",
    "  1. Roadmap  — high-level planning group (phase/track, e.g. Backend, Frontend,",
    "                Mobile, or Phase 1/2/3). If the document has no explicit tracks,",
    "                create ONE roadmap named after the system or 'Delivery'.",
    "  2. Module   — functional area (Authentication, Dashboard, Auction, Payments…).",
    "  3. Feature  — a concrete capability. EACH feature becomes exactly ONE task, so",
    "                keep features at the right granularity (e.g. 'Create Auction',",
    "                not each CRUD button).",
    "  4. Checklist— the detailed steps/sub-items INSIDE a feature (Upload Image,",
    "                Validation, Permission, API, Responsive, individual CRUD actions…).",
    "",
    "Rules:",
    "- Keep the board readable: fewer features, richer checklists.",
    "- Detect distinct user Roles and list them (Super Admin, Admin, Developer, Client…).",
    "- If a role-access matrix repeats the same module across roles, DEDUPE into one",
    "  module/feature and note the roles — do not duplicate per role.",
    "- Recognise numbered lists (1, 1.1, A, A.1, I, II), bullet lists and checkbox lists;",
    "  turn nested items into nested-looking checklist entries (prefix with the parent).",
    "- Map any '[IMAGE n]' / '[TABLE n]' markers to the feature they document via",
    "  imageRefs / tableRefs.",
    "- Give every roadmap, module, feature and checklist item a confidence score",
    "  (high/medium/low). Mark genuinely uncertain parsing as low.",
    "- Never invent features that are not supported by the document.",
  ].join("\n");
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
  // bytes are attached separately for vision).
  const body = parsed.text ? `\n\nDOCUMENT TEXT:\n${parsed.text.slice(0, 120_000)}` : "";

  return head + tableDump + body;
}
