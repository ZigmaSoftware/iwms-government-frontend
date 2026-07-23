import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * DailyTripCollectionPointForm's submit handler only ever guarded these three
 * fields — Trip Assignment, Collection Point and Bin. Sequence, Collected,
 * Status, Collected At/By/Weight are all optional at the point of save.
 */
export const dailyTripCollectionPointSchema = z.object({
  tripAssignmentId: requiredString("Trip Assignment"),
  collectionPointId: requiredString("Collection Point"),
  binId: requiredString("Bin"),
});

export type DailyTripCollectionPointFormValues = z.infer<typeof dailyTripCollectionPointSchema>;
