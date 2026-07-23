import { z } from "zod";
import { optionalString, requiredString } from "@/schemas/shared/fields";

/**
 * Mirrors the component's existing informal check — a role must be picked,
 * and then the matching operator/driver must be picked too — just split
 * into per-field messages instead of one combined "Missing details" popup.
 */
export const unassignedStaffPoolSchema = z
  .object({
    role: requiredString("Role"),
    operatorId: optionalString,
    driverId: optionalString,
    dailyTripAssignmentId: optionalString,
    status: requiredString("Status"),
  })
  .superRefine((data, ctx) => {
    if (data.role === "operator" && !data.operatorId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operatorId"],
        message: "Select an Operator",
      });
    }
    if (data.role === "driver" && !data.driverId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["driverId"],
        message: "Select a Driver",
      });
    }
  });

export type UnassignedStaffPoolFormValues = z.infer<typeof unassignedStaffPoolSchema>;
