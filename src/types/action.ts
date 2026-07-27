/**
 * Server Action result envelope (Engineering Standards §4, API-Contract §0.2).
 * Expected failures are RETURNED, never thrown.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TRANSITION_NOT_ALLOWED"
  | "LAST_OWNER"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "NOT_CONFIGURED"
  | "INTERNAL";

export type ApiError = {
  code: ErrorCode;
  message: string;
  /** Per-field validation messages (VALIDATION only). */
  fields?: Record<string, string[]>;
};

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export function actionError(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string[]>,
): { ok: false; error: ApiError } {
  return { ok: false, error: { code, message, fields } };
}

export function actionOk<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}
