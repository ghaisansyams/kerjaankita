import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { actionError, type ApiError, type ErrorCode } from "@/types/action";

/**
 * Map a Postgres/PostgREST error to our error taxonomy. Never leak raw DB
 * messages to the UI (Engineering Standards §4, §11).
 */
export function mapPostgrestError(error: PostgrestError): {
  ok: false;
  error: ApiError;
} {
  let code: ErrorCode = "INTERNAL";
  let message = "Something went wrong. Please try again.";

  switch (error.code) {
    case "23505": // unique_violation
      code = "CONFLICT";
      message = "That already exists.";
      break;
    case "23503": // foreign_key_violation
      code = "VALIDATION";
      message = "A referenced record was not found.";
      break;
    case "23514": // check_violation (e.g. workflow transition guard)
      code = "TRANSITION_NOT_ALLOWED";
      message = "That change isn't allowed here.";
      break;
    case "P0001": // raise_exception (custom guards, e.g. last owner)
      code = /owner/i.test(error.message) ? "LAST_OWNER" : "FORBIDDEN";
      message = error.message;
      break;
    case "42501": // insufficient_privilege / RLS denial
      code = "FORBIDDEN";
      message = "You don't have permission to do that.";
      break;
    default:
      if (error.code?.startsWith("PGRST")) {
        code = "NOT_FOUND";
        message = "Record not found.";
      }
  }

  // Log the technical detail server-side; surface only the safe message.
  console.error("[supabase]", error.code, error.message);
  return actionError(code, message);
}

/** Narrow an unknown thrown value to an ApiError result. */
export function mapUnknownError(e: unknown): { ok: false; error: ApiError } {
  if (e && typeof e === "object" && "code" in e && "message" in e) {
    return mapPostgrestError(e as PostgrestError);
  }
  console.error("[action]", e);
  return actionError("INTERNAL", "Something went wrong. Please try again.");
}
