import "server-only";
import type { ParsedDocument } from "./parsers";

export function buildImportSystemPrompt(): string {
  return [
    "You are an expert software business analyst. You read a software specification",
    "document (SRS, feature/functional spec, scope, client requirements, meeting",
    "minutes, a progress report, or a role → module → feature FLOWCHART) and",
    "reverse-engineer its structure into a clean, board-ready project plan.",
    "",
    "Map the document into this hierarchy:",
    "  1. Roadmap  — a high-level delivery track/phase. If the document is one system",
    "                with no explicit phases, create a FEW logical tracks (e.g.",
    "                'Autentikasi & Dashboard', 'Manajemen User', 'Master Data &",
    "                Setting', 'Booking & Meeting', 'Laporan & Log') or a single",
    "                'Delivery' roadmap.",
    "  2. Module   — a functional group of related areas inside a roadmap.",
    "  3. Feature  — a MAJOR area / screen-group. EACH becomes exactly ONE board task",
    "                (card). In a flowchart this is the TOP box of a column, e.g.",
    "                'Login/Logout', 'Dashboard', 'Management User', 'Management Master",
    "                Data', 'Setting', 'Booking Room'.",
    "  4. Checklist— the items DIRECTLY beneath that area become its checklist items.",
    "                In a flowchart these are the SECOND-row boxes, e.g. under",
    "                'Management User': 'Management User Super Admin', 'Management User",
    "                Admin Client'…; under 'Management Master Data': 'Management Floor',",
    "                'Management Room'…",
    "  5. children — if a checklist item has its own leaf actions, list them in that",
    "                item's `children` (ONE level deep only). In a flowchart these are",
    "                the WHITE leaf boxes, e.g. under 'Management User Super Admin':",
    "                'List User Super Admin', 'Detail User Super Admin', 'Add User",
    "                Super Admin', 'Edit…', 'Delete…'. If an area's items are already",
    "                leaves (e.g. 'Login/Logout' → 'Login With…', 'Session Login'…),",
    "                they are checklist items with NO children.",
    "",
    "Rules:",
    "- BE FAITHFUL AND COMPLETE. Use the document's OWN labels verbatim as names. Do",
    "  NOT invent generic names like 'Create User' or 'Manage X' — copy the real box",
    "  text. Capture EVERY distinct area, sub-module and leaf action; never summarise",
    "  them away or drop the CRUD leaves.",
    "- Detect distinct user Roles and list them (Super Admin, Admin, Client…).",
    "- If a role-access matrix repeats the same area across many roles, DEDUPE into ONE",
    "  task and note the roles in its description — do not repeat the area per role.",
    "- Recognise numbered/bullet/checkbox lists and flowchart columns & arrows.",
    "- Map any '[IMAGE n]' / '[TABLE n]' markers to the feature via imageRefs/tableRefs.",
    "- Give every level a confidence score (high/medium/low); mark uncertain parsing low.",
    "- Never invent content that is not supported by the document.",
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
