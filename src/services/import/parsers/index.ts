import "server-only";
import type { DocumentParser } from "./types";
import { DocxParser } from "./docx-parser";
import { PdfParser } from "./pdf-parser";
import { XlsxParser } from "./xlsx-parser";
import { CsvParser } from "./csv-parser";

export * from "./types";

// Register new formats (PowerPoint, …) here — the pipeline is agnostic.
const parsers: DocumentParser[] = [
  new DocxParser(),
  new PdfParser(),
  new XlsxParser(),
  new CsvParser(),
];

export function getParser(fileName: string): DocumentParser | null {
  return parsers.find((p) => p.supports(fileName)) ?? null;
}

export function supportedImportExtensions(): string[] {
  return [".docx", ".pdf", ".xlsx", ".csv"];
}
