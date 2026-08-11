import "server-only";
import ExcelJS from "exceljs";

export type SheetRows = { name: string; rows: string[][] };

/**
 * ExcelJS hands back a different shape per cell type (rich text, hyperlink,
 * formula, date…). Everything downstream wants plain text, so flatten here once.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    // Formula cells carry the cached result; hyperlinks carry display text.
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if (typeof v.text === "string") return v.text;
    if (typeof v.hyperlink === "string") return v.hyperlink;
    return "";
  }
  return String(value).trim();
}

/** Read every worksheet as a trimmed grid, dropping fully blank rows. */
export async function readSheetRows(buffer: Buffer): Promise<SheetRows[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets: SheetRows[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-indexed (index 0 is always empty) — drop the hole.
      const raw = Array.isArray(row.values) ? row.values.slice(1) : [];
      const cells = raw.map((c) => cellText(c as ExcelJS.CellValue).trim());
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      if (cells.some((c) => c !== "")) rows.push(cells);
    });
    if (rows.length) sheets.push({ name: ws.name, rows });
  });
  return sheets;
}
