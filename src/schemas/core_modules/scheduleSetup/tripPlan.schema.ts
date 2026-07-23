import { z } from "zod";

/**
 * One row of the inline collection-point Stops editor (Secondary Collection
 * only). `key` is UI-only React list bookkeeping (never sent to the API);
 * label fields are seed-only display text.
 */
const stopRowSchema = z.object({
  key: z.string(),
  collection_type: z.string(),
  collection_point_id: z.string(),
  bin_id: z.string(),
  customer_id: z.string(),
  is_active: z.boolean(),
  collectionPointLabel: z.string().optional(),
  binLabel: z.string().optional(),
});

/**
 * Mirrors exactly what the old manual checks in tripPlanForm.tsx's `onSubmit`
 * guarded (same messages, now surfaced through `toSwalMessage`):
 *  - State / District / Local Body / Staff Template / Vehicle: required
 *    together (matches the old combined message).
 *  - Waste Type: at least one selection required.
 *  - Collection point Stops: required, and each row needs a Collection Point
 *    and a Bin, but only when Collection Type is "bin_collection" (Household
 *    and Bulk are auto-expanded server-side and carry no manual stop rows).
 * The trigger-weight-vs-vehicle-capacity business rule stays a separate
 * manual check in the form, same as the date-overlap check in
 * alternativeStaffTemplate.schema.ts's sibling form.
 */
export const tripPlanSchema = z
  .object({
    stateId: z.string(),
    districtId: z.string(),
    areaTypeId: z.string(),
    hierarchyLevel: z.string(),
    hierarchyId: z.string(),
    staffTemplateId: z.string(),
    vehicleId: z.string(),
    supervisorId: z.string(),
    collectionType: z.string(),
    selectedWasteTypes: z.array(z.string()),
    scheduledTime: z.string(),
    tripTriggerWeightKg: z.string(),
    maxVehicleCapacityKg: z.string(),
    isAutoAssign: z.boolean(),
    repeatDays: z.array(z.number()),
    status: z.string(),
    approvalStatus: z.string(),
    stops: z.array(stopRowSchema),
  })
  .superRefine((value, ctx) => {
    if (
      !value.stateId ||
      !value.districtId ||
      !value.hierarchyId ||
      !value.staffTemplateId ||
      !value.vehicleId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["stateId"],
        message: "State, District, Local Body, Staff Template and Vehicle are required.",
      });
    }

    if (value.selectedWasteTypes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["selectedWasteTypes"],
        message: "Select at least one Waste Type.",
      });
    }

    if (value.collectionType === "bin_collection") {
      if (value.stops.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["stops"],
          message: "Add at least one collection point stop.",
        });
      } else if (value.stops.some((stop) => !stop.collection_point_id || !stop.bin_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["stops"],
          message: "Every stop needs a Collection Point and a Bin.",
        });
      }
    }
  });

export type TripPlanFormValues = z.infer<typeof tripPlanSchema>;
