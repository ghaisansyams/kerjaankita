import "server-only";
import { Prisma } from "@prisma/client";
import { actionError, type ApiError, type ErrorCode } from "@/types/action";

/**
 * Map a Prisma/Postgres error to our error taxonomy.
 */
export function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  ok: false;
  error: ApiError;
} {
  let code: ErrorCode = "INTERNAL";
  let message = "Something went wrong. Please try again.";

  switch (error.code) {
    case "P2002": // unique violation
      code = "CONFLICT";
      message = "A record with this identifier already exists.";
      break;
    case "P2003": // foreign key violation
      code = "VALIDATION";
      message = "A referenced record was not found.";
      break;
    case "P2025": // record not found
      code = "NOT_FOUND";
      message = "The requested record was not found.";
      break;
    default:
      message = "An error occurred while processing your request.";
  }

  console.error("[database error]", error.code, error.message);
  return actionError(code, message);
}

/** Narrow an unknown thrown value to an ApiError result. */
export function mapUnknownError(e: unknown): { ok: false; error: ApiError } {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(e);
  }
  if (e instanceof Error) {
    console.error("[action error]", e.message);
    return actionError("INTERNAL", e.message || "Something went wrong. Please try again.");
  }
  console.error("[unknown error]", e);
  return actionError("INTERNAL", "Something went wrong. Please try again.");
}
