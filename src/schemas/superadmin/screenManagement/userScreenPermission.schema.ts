import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * Mirrors the original inline check in UserScreenPermissionForm: a Local
 * Body (localBodyType + localBodyId, i.e. `hasLocalBody`) and at least one
 * Main Screen section (`mainScreenIds`) were required before submit. The
 * deeply nested per-screen permission matrix/columns are validated
 * separately in the component and are intentionally out of scope here.
 */
export const userScreenPermissionSchema = z.object({
  localBodyType: requiredString("Local Body Type"),
  localBodyId: requiredString("Local Body"),
  mainScreenIds: z
    .array(z.string())
    .min(1, "At least one Main Screen is required"),
});

export type UserScreenPermissionFormValues = z.infer<typeof userScreenPermissionSchema>;
