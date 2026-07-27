/** Date-format presets. `value` is stored on the profile; `pattern` is date-fns. */
export const DATE_FORMATS = [
  { value: "short", label: "12/31/2026", pattern: "MM/dd/yyyy" },
  { value: "medium", label: "Dec 31, 2026", pattern: "MMM d, yyyy" },
  { value: "long", label: "December 31, 2026", pattern: "MMMM d, yyyy" },
  { value: "eu", label: "31/12/2026", pattern: "dd/MM/yyyy" },
  { value: "iso", label: "2026-12-31", pattern: "yyyy-MM-dd" },
] as const;

export type DateFormatKey = (typeof DATE_FORMATS)[number]["value"];

export function dateFormatPattern(key: string): string {
  return DATE_FORMATS.find((d) => d.value === key)?.pattern ?? "MMM d, yyyy";
}

/** Language options — English shipping; the rest are future-ready scaffolding. */
export const LOCALES = [
  { value: "en", label: "English" },
  { value: "id", label: "Bahasa Indonesia" },
] as const;

/** A curated timezone list (full IANA list is available via Intl at runtime). */
export const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;
