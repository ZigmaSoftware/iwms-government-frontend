import { z } from "zod";

import { optionalString, requiredString } from "@/schemas/shared/fields";

export const vehicleCreationSchema = (showField: (field: string) => boolean) =>
  z
    .object({
      vehicle_no: optionalString,
      country_id: requiredString("Country"),
      state_id: requiredString("State"),
      district_id: requiredString("District"),
      area_type_id: requiredString("Area type"),
      local_body_level: requiredString("Local body level"),
      local_body_id: requiredString("Local body"),
    })
    .superRefine((data, ctx) => {
      if (showField("vehicle_no") && !data.vehicle_no) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vehicle_no"],
          message: "Vehicle no is required",
        });
      }
    });

export type VehicleCreationFormValues = z.infer<ReturnType<typeof vehicleCreationSchema>>;
