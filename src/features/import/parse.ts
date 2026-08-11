import "server-only";
import mammoth from "mammoth";
import { parse as parseHtml } from "node-html-parser";
import { extractText, getDocumentProxy } from "unpdf";
import { readSheetRows } from "@/services/import/parsers/xlsx-rows";

/**
 * Turns a raw progress report (.docx / .pdf / .xlsx) into an ordered list of tasks.
 * The document is expected to be a numbered list of items, each optionally
 * followed by screenshots (Word only) — exactly the format PICs already write.
 *
 * No AI: this is a deterministic parser. Word gives us the images inline (via
 * mammoth), so each screenshot is attached to the item it sits under. PDF is
 * text-only (image extraction from PDF is unreliable), so it yields titles.
 */

export type ParsedImage = { data: Buffer; contentType: string; ext: string };
export type ParsedTask = { title: string; description: string; images: ParsedImage[] };

const HEAD_TAGS = new Set(["li", "h1", "h2", "h3", "h4", "h5", "h6"]);
// Boilerplate lines that are never real tasks (report header / signatory block).
const STOP =
  /^(report progress|progress|mengetahui|distribusi.*|agenda.*|tanggal.*|tempat.*|waktu.*|onelito koi$|pt\.?\s|disiapkan|disetujui|depok,)/i;
const MAX_TASKS = 100;
const MAX_IMAGES_PER_TASK = 8;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const stripNum = (t: string) => t.replace(/^\s*\d+[.)]\s*/, "").trim();

type Block = { type: "head" | "text" | "img"; text?: string; src?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBlocks(node: any, out: Block[]) {
  for (const child of node.childNodes) {
    if (child.nodeType !== 1) continue; // elements only
    const tag = (child.rawTagName || "").toLowerCase();
    if (tag === "img") {
      out.push({ type: "img", src: child.getAttribute("src") });
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgs = child.querySelectorAll("img") as any[];
    const text = child.text.replace(/\s+/g, " ").trim();
    if (HEAD_TAGS.has(tag)) {
      if (text) out.push({ type: "head", text });
      imgs.forEach((im) => out.push({ type: "img", src: im.getAttribute("src") }));
    } else if (tag === "p") {
      if (imgs.length) imgs.forEach((im) => out.push({ type: "img", src: im.getAttribute("src") }));
      else if (text) out.push({ type: /^\d+[.)]\s+/.test(text) ? "head" : "text", text });
    } else {
      // containers (table/td/ol/ul/div/body …): recurse to preserve order
      collectBlocks(child, out);
    }
  }
}

function buildTasks(blocks: Block[]): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  let cur: ParsedTask | null = null;
  for (const b of blocks) {
    if (b.type === "head") {
      const title = stripNum(b.text || "");
      if (!title || STOP.test(title)) {
        cur = null;
        continue;
      }
      cur = { title: title.slice(0, 200), description: "", images: [] };
      tasks.push(cur);
    } else if (b.type === "text" && cur) {
      const add = (b.text || "").trim();
      if (add) cur.description = (cur.description ? `${cur.description}\n` : "") + add;
    } else if (b.type === "img" && cur) {
      // resolved later by the caller; here `src` carries the image index
      if (cur.images.length < MAX_IMAGES_PER_TASK && b.src) {
        (cur as ParsedTask & { _imgSrc?: string[] })._imgSrc ??= [];
        (cur as ParsedTask & { _imgSrc: string[] })._imgSrc.push(b.src);
      }
    }
  }
  return tasks;
}

export async function parseDocx(buffer: Buffer): Promise<ParsedTask[]> {
  const images: ParsedImage[] = [];
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const b64 = await image.read("base64");
        const contentType = (image.contentType || "image/png").toLowerCase();
        const idx = images.length;
        images.push({
          data: Buffer.from(b64, "base64"),
          contentType,
          ext: EXT[contentType] || "png",
        });
        return { src: `img://${idx}` };
      }),
    },
  );

  const root = parseHtml(html);
  const blocks: Block[] = [];
  collectBlocks(root, blocks);

  const tasks = buildTasks(blocks);
  // resolve image indices → buffers
  for (const t of tasks) {
    const srcs = (t as ParsedTask & { _imgSrc?: string[] })._imgSrc ?? [];
    for (const s of srcs) {
      const m = /^img:\/\/(\d+)$/.exec(s);
      const img = m ? images[Number(m[1])] : undefined;
      if (img) t.images.push(img);
    }
    delete (t as ParsedTask & { _imgSrc?: string[] })._imgSrc;
  }

  // Progress reports have a screenshot per item — keep the image-bearing run,
  // which drops noise headings ("Mengetahui" participants, "PROGRESS", …).
  const withImg = tasks.filter((t) => t.images.length);
  const chosen = withImg.length >= 3 ? withImg : tasks;
  return chosen.slice(0, MAX_TASKS);
}

export async function parsePdf(buffer: Buffer): Promise<ParsedTask[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const raw = Array.isArray(text) ? text.join("\n") : text;
  const lines = raw.split(/\r?\n/).map((l) => l.trim());

  const tasks: ParsedTask[] = [];
  let cur: ParsedTask | null = null;
  for (const line of lines) {
    if (!line) continue;
    const m = /^(\d+)[.)]\s+(.+)$/.exec(line);
    if (m) {
      const title = m[2].trim();
      if (!title || STOP.test(title)) {
        cur = null;
        continue;
      }
      cur = { title: title.slice(0, 200), description: "", images: [] };
      tasks.push(cur);
    } else if (cur && !STOP.test(line)) {
      cur.description = (cur.description ? `${cur.description}\n` : "") + line;
    }
  }
  return tasks.slice(0, MAX_TASKS);
}

/** Header cells that mark the column holding the task itself. */
const TITLE_HEAD =
  /^(task|tasks|judul|title|pekerjaan|kegiatan|aktivitas|item|deskripsi tugas|nama tugas|to ?do)$/i;
/** Header cells whose column is supporting detail rather than the task. */
const DESC_HEAD = /^(deskripsi|description|keterangan|catatan|notes?|detail|remarks?)$/i;
/** A row is a header if any cell names a column we recognise. */
const isHeaderRow = (row: string[]) =>
  row.some((c) => TITLE_HEAD.test(c) || DESC_HEAD.test(c));

/**
 * XLSX → one task per row. A spreadsheet is already a list, so there's no
 * numbered-heading heuristic to run: we look for a header row to learn which
 * column is the task and which are detail, and fall back to "first non-empty
 * cell is the title, the rest is description" for sheets without one.
 */
export async function parseXlsx(buffer: Buffer): Promise<ParsedTask[]> {
  const sheets = await readSheetRows(buffer);
  const tasks: ParsedTask[] = [];

  for (const sheet of sheets) {
    let titleCol = -1;
    let descCols: number[] = [];
    let start = 0;

    const head = sheet.rows[0];
    if (head && isHeaderRow(head)) {
      start = 1;
      titleCol = head.findIndex((c) => TITLE_HEAD.test(c));
      descCols = head
        .map((c, i) => (DESC_HEAD.test(c) ? i : -1))
        .filter((i) => i >= 0);
    }

    for (const row of sheet.rows.slice(start)) {
      // Without a header, the first cell carrying text is the task.
      const ti = titleCol >= 0 ? titleCol : row.findIndex((c) => c !== "");
      const title = stripNum((row[ti] ?? "").trim());
      if (!title || STOP.test(title)) continue;

      const detail = (descCols.length ? descCols.map((i) => row[i]) : row.filter((_, i) => i !== ti))
        .map((c) => (c ?? "").trim())
        .filter(Boolean)
        .join("\n");

      tasks.push({ title: title.slice(0, 200), description: detail, images: [] });
      if (tasks.length >= MAX_TASKS) return tasks;
    }
  }
  return tasks;
}

export async function parseDocument(buffer: Buffer, fileName: string): Promise<ParsedTask[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx")) return parseDocx(buffer);
  if (lower.endsWith(".pdf")) return parsePdf(buffer);
  if (lower.endsWith(".xlsx")) return parseXlsx(buffer);
  throw new Error("Unsupported file type. Upload a .docx, .pdf or .xlsx.");
}
