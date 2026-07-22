import type { ZodError } from "zod";

/** Aggregates a ZodError's issues into one human-readable message, for flows that
 * still surface a single summary popup instead of inline per-field errors. */
export function toSwalMessage(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join("\n");
}
