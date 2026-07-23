import { z } from "zod";
import {
  emailField,
  requiredString,
  optionalString,
} from "@/schemas/shared/fields";

export const leaderSchemaBase = {
  username: requiredString("Username"),
  email: emailField.optional().or(z.literal("")).transform((value) => value || ""),
  leader_name: optionalString,
  is_active: z.boolean(),
};
