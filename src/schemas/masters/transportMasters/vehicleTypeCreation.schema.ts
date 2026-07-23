import { z } from "zod";

import { optionalString } from "@/schemas/shared/fields";

export const vehicleTypeCreationSchema = (showField: (field: string) => boolean) =>
  z
    .object({
      vehicleType: optionalString,
    })
    .superRefine((data, ctx) => {
      if (showField("vehicleType") && !data.vehicleType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vehicleType"],
          message: "Vehicle type is required",
        });
      }
    });

export type VehicleTypeCreationFormValues = z.infer<ReturnType<typeof vehicleTypeCreationSchema>>;
