import { z } from "zod";
import { requiredString } from "@/schemas/shared/fields";

export const subPropertySchema = z.object({
  property_id: requiredString("Property"),
  sub_property_name: requiredString("Sub-property name"),
  is_active: z.boolean(),
});

export type SubPropertyFormValues = z.infer<typeof subPropertySchema>;
