import { z } from "zod";
import { requiredString } from "@/schemas/shared/fields";

export const propertySchema = z.object({
  property_name: requiredString("Property name"),
  is_active: z.boolean(),
});

export type PropertyFormValues = z.infer<typeof propertySchema>;
