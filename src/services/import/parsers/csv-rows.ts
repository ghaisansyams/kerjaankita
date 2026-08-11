import "server-only";

/**
 * RFC 4180 reader: honours quoted fields, "" escapes, and newlines inside
 * quotes — all of which Jira descriptions actually contain, so a naive
 * split(",") would shred the file.
 */
export function readDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') {
        field += c;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Comma, semicolon (European Excel) or tab — whichever splits the header widest. */
function sniffDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  let best = ",";
  let width = 0;
  for (const d of [",", ";", "\t"]) {
    const cols = readDelimited(sample, d)[0]?.length ?? 0;
    if (cols > width) {
      width = cols;
      best = d;
    }
  }
  return best;
}

/** Decode (tolerating non-UTF-8 exports), sniff the delimiter, and split. */
export function readCsvRows(buffer: Buffer): string[][] {
  // Excel and Jira both hand out CSVs that aren't UTF-8 as often as they are.
  let text = buffer.toString("utf8");
  if (text.includes("�")) text = buffer.toString("latin1");
  text = text.replace(/^﻿/, "");
  return readDelimited(text, sniffDelimiter(text));
}
