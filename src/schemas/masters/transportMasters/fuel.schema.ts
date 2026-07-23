import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

export const fuelSchema = z.object({
  fuel_type: requiredString("Fuel type"),
  description: requiredString("Description"),
  is_active: z.boolean(),
});

export type FuelFormValues = z.infer<typeof fuelSchema>;
