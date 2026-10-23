import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/** IntegerField upper bound (PostgreSQL integer). */
const MAX_ORDER_NO = 2147483647;

/**
 * Inline App Module edit (AppModuleSerializer — only label/order_no/is_active
 * are writable):
 * - label required, CharField max_length=60
 * - order_no a whole number (IntegerField), 0 or more
 */
export const appModuleSchema = z.object({
  label: requiredString("Label").max(60, "Label must be at most 60 characters"),
  order_no: z
    .string()
    .trim()
    .min(1, { message: "Order is required", abort: true })
    .regex(/^\d+$/, "Order must be a whole number of 0 or more")
    .transform(Number)
    .pipe(z.number().int().max(MAX_ORDER_NO, "Order is too large")),
});

export type AppModuleFormInput = z.input<typeof appModuleSchema>;
export type AppModuleFormValues = z.output<typeof appModuleSchema>;
