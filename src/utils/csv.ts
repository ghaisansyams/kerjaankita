type Col = { key: string; label: string };

/** Serialize columns + rows to RFC-4180-ish CSV (used by client-side export). */
export function toCsv(columns: Col[], rows: Record<string, string | number>[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(","));
  return [header, ...body].join("\n");
}
