import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * BinCollectionEventForm's submit handler guarded these fields before save:
 *  - tripAssignmentId / tripCollectionPointId / binId / collectionDate:
 *    always required (the top-level `if` check).
 *  - collectedWeightKg: required only when collectionStatus is "Collected".
 *  - statusReason: required only when collectionStatus is NOT "Collected"
 *    (i.e. for "Not Collected" / "Collect Later").
 * Every other field (geo cascade, driver lat/lng, notes) was never blocked
 * on and stays unvalidated here too.
 */
export const binCollectionEventSchema = z
  .object({
    tripAssignmentId: requiredString("Trip Assignment"),
    tripCollectionPointId: requiredString("Collection Point"),
    binId: requiredString("Bin"),
    collectionDate: requiredString("Collection Date"),
    collectionStatus: z.string(),
    collectedWeightKg: z.string(),
    statusReason: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.collectionStatus === "Collected" && !data.collectedWeightKg.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["collectedWeightKg"],
        message: "Collected Weight Kg is required when status is Collected.",
      });
    }
    if (data.collectionStatus !== "Collected" && !data.statusReason.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["statusReason"],
        message: "Reason is required for Not Collected and Collect Later.",
      });
    }
  });

export type BinCollectionEventFormValues = z.infer<typeof binCollectionEventSchema>;
