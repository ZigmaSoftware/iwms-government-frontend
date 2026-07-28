import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

export const userTypeSchema = z.object({
  name: requiredString("User Type Name"),
  is_active: z.boolean(),
});

export type UserTypeFormValues = z.infer<typeof userTypeSchema>;
