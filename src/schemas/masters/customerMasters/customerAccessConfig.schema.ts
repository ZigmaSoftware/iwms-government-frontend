import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

const idList = (label: string) =>
  z
    .array(z.string().trim().min(1, `${label} contains an empty selection`))
    .refine((ids) => new Set(ids).size === ids.length, `${label} contains duplicates`);

/**
 * Customer app access (CustomerAccessConfigurationSerializer):
 * - customer_unique_id required (CustomerCreation unique_id; stored in
 *   customer_id CharField max_length=30)
 * - app_module_ids / app_screen_ids: lists of unique ids. Empty lists are
 *   allowed — no module ticked deliberately means mobile sign-in is refused.
 */
export const customerAccessConfigSchema = z.object({
  customer_unique_id: requiredString("Customer").max(30, "Customer id must be at most 30 characters"),
  app_module_ids: idList("App modules"),
  app_screen_ids: idList("App screens"),
});

export type CustomerAccessConfigValues = z.infer<typeof customerAccessConfigSchema>;
