import "server-only";
import type { DocumentParser, ParsedDocument, ParsedTable } from "./types";
import { readSheetRows } from "./xlsx-rows";

/**
 * XLSX → one [TABLE n] per worksheet, plus a text rendering of the same grid.
 *
 * A spreadsheet is already tabular, so the tables carry the real structure and
 * the text is there for models that reason better over prose. Embedded images
 * are ignored: in the sheets people actually hand us they're decoration, and
 * they carry no reliable anchor to a given row.
 */
export class XlsxParser implements DocumentParser {
  readonly kind = "xlsx";

  supports(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".xlsx");
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const sheets = await readSheetRows(buffer);
    const tables: ParsedTable[] = [];
    const lines: string[] = [];

    for (const sheet of sheets) {
      const index = tables.length;
      tables.push({ index, caption: sheet.name, rows: sheet.rows });
      lines.push(`# ${sheet.name}`);
      lines.push(`[TABLE ${index}]`);
      for (const row of sheet.rows) {
        const text = row.filter(Boolean).join(" | ");
        if (text) lines.push(`- ${text}`);
      }
    }

    return { kind: "xlsx", text: lines.join("\n"), images: [], tables };
  }
}
