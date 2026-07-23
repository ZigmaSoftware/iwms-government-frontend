import { z } from "zod";
import { optionalString, requiredString } from "@/schemas/shared/fields";
import { leaderSchemaBase } from "./leaderBase.schema";

export const buildPanchayatLeaderSchema = (isEdit: boolean) =>
  z.object({
    ...leaderSchemaBase,
    panchayat_id: requiredString("Panchayat"),
    password: optionalString,
  }).superRefine((data, ctx) => {
    if (!isEdit && !data.password.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password is required when creating a new leader.",
      });
    }
  });
