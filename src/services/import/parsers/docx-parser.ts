import "server-only";
import mammoth from "mammoth";
import { parse as parseHtml } from "node-html-parser";
import type { DocumentParser, ParsedDocument, ParsedImage, ParsedTable } from "./types";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** DOCX → text (with [IMAGE n]/[TABLE n] markers) + extracted images + tables. */
export class DocxParser implements DocumentParser {
  readonly kind = "docx";

  supports(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".docx");
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const images: ParsedImage[] = [];
    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const b64 = await image.read("base64");
          const ct = (image.contentType || "image/png").toLowerCase();
          const index = images.length;
          images.push({ index, data: Buffer.from(b64, "base64"), contentType: ct, ext: EXT[ct] || "png" });
          return { src: `image://${index}` };
        }),
      },
    );

    const root = parseHtml(html);
    const tables: ParsedTable[] = [];
    const lines: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgIdx = (el: any) => {
      const m = /image:\/\/(\d+)/.exec(el.getAttribute("src") || "");
      return m ? Number(m[1]) : null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (node: any) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        const tag = (child.rawTagName || "").toLowerCase();
        if (tag === "img") {
          const i = imgIdx(child);
          if (i !== null) lines.push(`[IMAGE ${i}]`);
          continue;
        }
        if (tag === "table") {
          const rows = child
            .querySelectorAll("tr")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((tr: any) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tr.querySelectorAll("th,td").map((td: any) => td.text.replace(/\s+/g, " ").trim()),
            );
          const index = tables.length;
          tables.push({ index, rows });
          lines.push(`[TABLE ${index}]`);
          continue;
        }
        if (["p", "li", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
          const text = child.text.replace(/\s+/g, " ").trim();
          if (text) {
            const prefix = tag.startsWith("h") ? "# " : tag === "li" ? "- " : "";
            lines.push(prefix + text);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          child.querySelectorAll("img").forEach((im: any) => {
            const i = imgIdx(im);
            if (i !== null) lines.push(`[IMAGE ${i}]`);
          });
        } else {
          walk(child);
        }
      }
    };
    walk(root);

    return { kind: "docx", text: lines.join("\n"), images, tables };
  }
}
