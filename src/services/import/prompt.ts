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
    "For EACH feature, list its SUB-MODULES (the SECOND-row boxes directly under the",
    "area) as `checklist` items — NAMES ONLY, do NOT add `children` (the leaf actions",
    "are filled in later). Examples:",
    "  'Management User' → 'Management User Super Admin', 'Management User Admin Client',",
    "     'Management User Admin Mitra', 'Management User Secretary Client', … ;",
    "  'Management Master Data' → 'Management Floor', 'Management Room', 'Management",
    "     Layout Room', 'Managemen Devision', 'Management Kategori Makanan', … ;",
    "  'Setting' → 'Management Marge Room', 'Layout Display Setting', 'Management Room",
    "     Facilities', 'Menu Access Settings', 'Display Setting', 'K-Kios Setting', … .",
    "List EVERY sub-module. If an area has no sub-modules (only leaf boxes, e.g.",
    "'Login/Logout' → 'Login With…', 'Session Login'…), list those leaves instead.",
    "",
    "Rules:",
    "- Use the document's OWN labels verbatim — never invent generic names like",
    "  'Create User' or 'Manage X'.",
    "- Scan EVERY role's pages so no area/sub-module is missed; dedupe an area that",
    "  repeats across roles into ONE feature (collecting all its roles).",
    "- Also fill top-level `roles` with the full list of distinct roles found.",
    "- Confidence per level; never invent content.",
  ].join("\n");
}

// PASS 2 — expand ONE area into a COMPLETE nested checklist.
export function buildExpandSystemPrompt(): string {
  return [
    "You expand ONE area of a software-spec flowchart into a COMPLETE nested checklist.",
    "",
    "- Each SUB-MODULE becomes ONE checklist item. A sub-module is a SECOND-row box —",
    "  it has leaf actions beneath it; it is NOT a leaf itself.",
    "- Under each sub-module, list ALL of its leaf actions (the WHITE boxes: List,",
    "  Detail, Add, Edit, Delete, Import, Download, Preview, Setting, Send…, Order…,",
    "  Activate…, etc.) as `children`, copied verbatim.",
    "- Expand EVERY sub-module named in the request AND any others you find in the",
    "  document. NEVER merge several sub-modules into one item's children.",
    "- If a sub-module truly has no leaves in the document, keep it as an item with an",
    "  empty `children` list. Do NOT invent children that aren't there.",
    "- Do not stop early or summarise; list every sub-module and every leaf.",
  ].join("\n");
}

export function buildExpandUserPrompt(areaName: string, subModules: string[], docText: string): string {
  const slice = docText ? sliceDocForArea(docText, areaName) : "";
  const known = subModules.filter((s) => s && s.trim()).slice(0, 60);
  const hint = known.length
    ? `\n\nKnown sub-modules of "${areaName}" — expand EACH as its own checklist item (and add any others you find): ${known.join(", ")}.`
    : "";
  const body = slice ? `\n\nDOCUMENT (relevant excerpt):\n${slice}` : "";
  return (
    `Expand the area "${areaName}" COMPLETELY. List every sub-module as a checklist ` +
    `item, and every leaf action under each sub-module as its children.` +
    hint +
    body
  );
}

/**
 * Keep only the lines relevant to one area — from each mention of the area (or a
 * fragment of its name) plus a window of following lines. Shrinks a per-area
 * expand request a lot (cheaper against the token budget) and sharpens accuracy.
 * Falls back to the whole compacted document if nothing matches.
 */
export function sliceDocForArea(raw: string, areaName: string): string {
  const compact = compactText(raw);
  const lines = compact.split("\n");
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(areaName);
  const WINDOW = 45;
  const keep = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const ln = norm(lines[i]);
    if (ln.length < 3) continue;
    if (ln.includes(target) || (target.includes(ln) && ln.split(" ").length >= 1)) {
      for (let k = i; k < Math.min(lines.length, i + WINDOW); k++) keep.add(k);
    }
  }
  if (keep.size === 0) return compact.slice(0, 120_000);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of [...keep].sort((a, b) => a - b)) {
    const key = norm(lines[i]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lines[i]);
  }
  return out.join("\n").slice(0, 120_000);
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
