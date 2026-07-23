import { z } from "zod";
import { requiredString, optionalString } from "@/schemas/shared/fields";

export const binSchema = z
  .object({
    countryId: requiredString("Country"),
    stateId: requiredString("State"),
    districtId: requiredString("District"),
    areaTypeId: requiredString("Area type"),
    localBodyLevel: requiredString("Local body level"),
    localBodyId: requiredString("Local body"),
    collectionPointId: requiredString("Collection point"),
    wasteTypeId: requiredString("Waste type"),
    binName: requiredString("Bin name"),
    binCapacity: optionalString,
    binType: optionalString,
    latitude: optionalString,
    longitude: optionalString,
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const hasLatitude = Boolean(data.latitude);
    const hasLongitude = Boolean(data.longitude);

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasLatitude ? "longitude" : "latitude"],
        message: "Latitude and Longitude must be provided together.",
      });
      return;
    }

    if (hasLatitude && hasLongitude) {
      const latitudeNumber = Number(data.latitude);
      const longitudeNumber = Number(data.longitude);

      if (!Number.isFinite(latitudeNumber) || latitudeNumber < -90 || latitudeNumber > 90) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["latitude"],
          message: "Latitude must be between -90 and 90.",
        });
      }

      if (!Number.isFinite(longitudeNumber) || longitudeNumber < -180 || longitudeNumber > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["longitude"],
          message: "Longitude must be between -180 and 180.",
        });
      }
    }
  });

export type BinFormValues = z.infer<typeof binSchema>;
