import { z } from "zod";
import { requiredString, optionalString } from "@/schemas/shared/fields";

export const wasteTypeSchema = z.object({
  waste_type_name: requiredString("Waste type name"),
  is_active: z.boolean(),
  default_team: optionalString.optional().nullable(),
  default_priority: optionalString.optional().nullable(),
  assign_within_minutes: z.coerce.number().int().nonnegative().optional().nullable(),
  resolve_within_minutes: z.coerce.number().int().nonnegative().optional().nullable(),
  working_hours_only: z.boolean(),
});

export type WasteTypeFormValues = z.infer<typeof wasteTypeSchema>;
