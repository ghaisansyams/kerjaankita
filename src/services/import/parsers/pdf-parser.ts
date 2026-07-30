import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { DocumentParser, ParsedDocument } from "./types";

/**
 * PDF → selectable text + raw bytes (base64). A vision provider reads the
 * base64 directly to recover layout (flowcharts, tables, diagrams). Embedded
 * raster-image extraction from PDF is deferred to phase 2 (unpdf returns raw
 * pixel buffers that need re-encoding); DOCX remains the path for auto-attached
 * images. Scanned/no-text PDFs fall back to sending bytes to the vision model.
 */
export class PdfParser implements DocumentParser {
  readonly kind = "pdf";

  supports(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".pdf");
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    let text = "";
    let pageCount: number | undefined;
    try {
      const res = await extractText(pdf, { mergePages: true });
      text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
      pageCount = res.totalPages;
    } catch {
      text = ""; // scanned PDF with no selectable text → vision model handles it
    }
    return {
      kind: "pdf",
      text,
      images: [],
      tables: [],
      pdfBase64: buffer.toString("base64"),
      pageCount,
    };
  }
}
