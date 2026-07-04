import { ZodError } from "zod";

import {
  InvalidTransitionError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/shared/errors";

/**
 * Converts any error thrown by a core service into a plain, user-facing
 * Turkish message for display in a Server Action's form state. Never
 * surfaces raw internal error details for unrecognized error types.
 */
export function toActionErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Girilen bilgiler geçersiz.";
  }
  if (
    error instanceof UnauthorizedError ||
    error instanceof NotFoundError ||
    error instanceof ValidationError ||
    error instanceof InvalidTransitionError
  ) {
    return error.message;
  }
  console.error(error);
  return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
}
