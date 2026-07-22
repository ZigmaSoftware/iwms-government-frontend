import { z } from "zod";

import { optionalString, requiredString } from "./fields";

/**
 * Mirrors the original inline check in UserScreenForm: mainscreenId,
 * userScreenName, and folderName were required before submit; orderNo
 * (edit-only, backend auto-assigns on create) and description were never
 * validated.
 */
export const userScreenSchema = z.object({
  mainscreenId: requiredString("Main Screen"),
  userScreenName: requiredString("User Screen Name"),
  folderName: requiredString("Folder Path"),
  orderNo: optionalString,
  description: optionalString,
  isActive: z.boolean(),
});

export type UserScreenFormValues = z.infer<typeof userScreenSchema>;
