import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component (mob_code/currency are already
 * optional here since they were never required-checked even when visible —
 * `mob_code` is the country's ISD/dial code, e.g. "+91", not a personal
 * 10-digit mobile number, so it deliberately does not use `mobileField`).
 */
export const countrySchema = z.object({
  continent_id: requiredString("Continent"),
  name: requiredString("Country Name"),
  mob_code: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  is_active: z.boolean(),
});

export type CountryFormValues = z.infer<typeof countrySchema>;
