import { z } from "zod";

import { requiredString, optionalString } from "@/schemas/shared/fields";

export const tripExceptionLogSchema = z.object({
  daily_trip_assignment_id: requiredString("Daily trip assignment"),
  exception_type: requiredString("Exception type"),
  remarks: optionalString.optional().nullable(),
  detected_by: requiredString("Detected by"),
});

export type TripExceptionLogFormValues = z.infer<typeof tripExceptionLogSchema>;
