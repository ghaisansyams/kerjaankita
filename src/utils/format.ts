import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

export function getInitials(
  name?: string | null,
  fallback?: string | null,
): string {
  const src = name?.trim() || fallback || "?";
  return (
    src
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Parse a Postgres date ('yyyy-mm-dd') or timestamptz string into a Date. */
export function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = value.length <= 10 ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

export function formatDate(value?: string | null, fmt = "MMM d, yyyy"): string {
  const d = toDate(value);
  return d ? format(d, fmt) : "—";
}

export function formatRelative(value?: string | null): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "";
}

/** Turn a display name into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
