import { z } from "zod";

/**
 * Remarks / reason fields on workflow actions (approve, reject, verify,
 * resolve, reopen, ...). Every backend column behind these is an unbounded
 * `TextField`, so the cap here is a UI limit, matching the `inputMaxLength:
 * 1000` the notify text-box popups already enforce.
 */
export const REMARKS_MAX_LENGTH = 1000;

const tooLongMessage = (label: string, max: number) => `${label} must be at most ${max} characters`;

/** Remarks that must be non-blank (after trimming). */
export const requiredRemarks = ({
  label = "Remarks",
  requiredMessage = `${label} is required`,
  max = REMARKS_MAX_LENGTH,
}: { label?: string; requiredMessage?: string; max?: number } = {}) =>
  z.string().trim().min(1, requiredMessage).max(max, tooLongMessage(label, max));

/** Remarks that may be blank, but are still length-capped. */
export const optionalRemarks = ({
  label = "Remarks",
  max = REMARKS_MAX_LENGTH,
}: { label?: string; max?: number } = {}) => z.string().trim().max(max, tooLongMessage(label, max));

/**
 * Runs a schema and returns its first issue message, or null when valid —
 * the shape a notify popup `inputValidator` expects.
 */
export function firstIssueMessage(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid value");
}
