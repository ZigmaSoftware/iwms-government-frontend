import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

export const binLoadLogSchema = z.object({
  vehicle_id: requiredString("Vehicle"),
  property_id: requiredString("Property"),
  sub_property_id: requiredString("Sub property"),
  weight_kg: requiredString("Weight kg"),
  source_type: requiredString("Source type"),
  event_time: requiredString("Event time"),
});

export type BinLoadLogFormValues = z.infer<typeof binLoadLogSchema>;
