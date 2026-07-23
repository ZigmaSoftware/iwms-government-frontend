import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

export const vehicleTripAuditSchema = z.object({
  daily_trip_assignment_id: requiredString("Daily trip assignment"),
  vehicle_id: requiredString("Vehicle"),
  gps_lat: requiredString("GPS latitude"),
  gps_lon: requiredString("GPS longitude"),
  avg_speed: requiredString("Average speed"),
});

export type VehicleTripAuditFormValues = z.infer<typeof vehicleTripAuditSchema>;
