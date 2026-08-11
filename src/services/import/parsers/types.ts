// Parser abstraction. Adding PowerPoint later = implement DocumentParser
// and register it in ./index — the pipeline is format-agnostic.

export type ParsedImage = {
  index: number;
  data: Buffer;
  contentType: string;
  ext: string;
};

export type ParsedTable = {
  index: number;
  caption?: string;
  rows: string[][];
};

export type ParsedDocument = {
  kind: "docx" | "pdf" | "xlsx";
  /** Plain text, with `[IMAGE n]` / `[TABLE n]` placeholders where known. */
  text: string;
  images: ParsedImage[];
  tables: ParsedTable[];
  /** PDFs carry their raw bytes so a vision-capable provider can read layout. */
  pdfBase64?: string;
  pageCount?: number;
};

export interface DocumentParser {
  readonly kind: string;
  supports(fileName: string): boolean;
  parse(buffer: Buffer, fileName: string): Promise<ParsedDocument>;
}
