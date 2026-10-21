import { z } from "zod";
import { requiredString, optionalString } from "@/schemas/shared/fields";

export const wasteTypeSchema = z.object({
  waste_type_name: requiredString("Waste type name"),
  is_active: z.boolean(),
  default_priority: optionalString.optional().nullable(),
});

export type WasteTypeFormValues = z.infer<typeof wasteTypeSchema>;
