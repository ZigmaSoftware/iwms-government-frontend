import { z } from "zod";

import { optionalString, requiredString } from "@/schemas/shared/fields";

export const LATITUDE_MESSAGE = "Latitude must be between -90 and 90";
export const LONGITUDE_MESSAGE = "Longitude must be between -180 and 180";

export const collectionMonitoringSchema = z.object({
  tripCollectionPointId: requiredString("Trip Collection Point"),
  weight: requiredString("Collected Weight"),
  driverLatitude: optionalString
    .optional()
    .refine(
      (value) => !value || (Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90),
      { message: LATITUDE_MESSAGE },
    ),
  driverLongitude: optionalString
    .optional()
    .refine(
      (value) => !value || (Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180),
      { message: LONGITUDE_MESSAGE },
    ),
  notes: optionalString.optional(),
});

export type CollectionMonitoringFormValues = z.infer<typeof collectionMonitoringSchema>;
