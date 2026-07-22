import { z } from "zod";

import { optionalString, requiredString } from "./fields";

/**
 * Mirrors the original inline check in MainScreenForm: mainscreenTypeId and
 * mainscreenName were required before submit; orderNo (edit-only, backend
 * auto-assigns on create) and description were never validated.
 */
export const mainScreenSchema = z.object({
  mainscreenTypeId: requiredString("Main Screen Type"),
  mainscreenName: requiredString("Main Screen Name"),
  orderNo: optionalString,
  description: optionalString,
  isActive: z.boolean(),
});

export type MainScreenFormValues = z.infer<typeof mainScreenSchema>;
