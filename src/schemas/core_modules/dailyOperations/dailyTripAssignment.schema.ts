import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * DailyTripAssignmentForm's submit handler guarded exactly these six fields
 * before save: Trip Plan, Staff Template, Local Body (`hierarchyId`), at
 * least one Waste Type, Trip Date and Start Time. Alternative Staff
 * Template, State/District/Area Type, Remarks, Status/Approval Status and
 * the inline collection-point/household-stop editors were never blocked on
 * and stay unvalidated here too.
 */
export const dailyTripAssignmentSchema = z.object({
  tripPlanId: requiredString("Trip Plan"),
  staffTemplateId: requiredString("Staff Template"),
  hierarchyId: requiredString("Local Body"),
  selectedWasteTypes: z.array(z.string()).min(1, "Waste Type is required"),
  tripDate: requiredString("Trip Date"),
  scheduledTime: requiredString("Start Time"),
});

export type DailyTripAssignmentFormValues = z.infer<typeof dailyTripAssignmentSchema>;
