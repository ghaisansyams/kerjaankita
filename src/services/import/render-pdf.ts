import "server-only";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

/**
 * Render PDF pages to PNG data URLs for vision analysis. Parses the document
 * once, then renders each page via @napi-rs/canvas (serverless-friendly). Used
 * ONLY by providers that accept image input; failures are caught by the caller,
 * which falls back to text extraction — vision is never allowed to break import.
 */
export async function renderPdfPagesAsDataUrls(
  pdfBase64: string,
  opts: { maxPages?: number; width?: number } = {},
): Promise<string[]> {
  const maxPages = Math.max(1, opts.maxPages ?? 20);
  const width = Math.max(512, opts.width ?? 1600);
  const bytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
  const pdf = await getDocumentProxy(bytes);
  const total = Math.min(pdf.numPages, maxPages);

  const urls: string[] = [];
  for (let page = 1; page <= total; page++) {
    const dataUrl = await renderPageAsImage(pdf, page, {
      canvasImport: () => import("@napi-rs/canvas"),
      width,
      toDataURL: true,
    });
    urls.push(dataUrl);
  }
  return urls;
}
