import { z } from "zod";

import { optionalString } from "@/schemas/shared/fields";

export const tripAttendanceSchema = (
  isEdit: boolean,
  showField: (field: string) => boolean
) =>
  z
    .object({
      daily_trip_assignment_id: optionalString,
      staff_id: optionalString,
      vehicle_id: optionalString,
      latitude: optionalString,
      longitude: optionalString,
      source: optionalString,
    })
    .superRefine((data, ctx) => {
      if (!isEdit && showField("daily_trip_assignment_id") && !data.daily_trip_assignment_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["daily_trip_assignment_id"], message: "Daily trip assignment is required" });
      }
      if (!isEdit && showField("staff_id") && !data.staff_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["staff_id"], message: "Staff is required" });
      }
      if (!isEdit && showField("vehicle_id") && !data.vehicle_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vehicle_id"], message: "Vehicle is required" });
      }
      if (showField("latitude") && data.latitude === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Latitude is required" });
      }
      if (showField("longitude") && data.longitude === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["longitude"], message: "Longitude is required" });
      }
      if (showField("source") && !data.source) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source"], message: "Source is required" });
      }
    });

export type TripAttendanceFormValues = z.infer<ReturnType<typeof tripAttendanceSchema>>;
