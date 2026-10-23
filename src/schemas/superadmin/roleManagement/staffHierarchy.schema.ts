import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/** Optional plain unique_id reference (blank = not set). Mirrors the backend's
 * nullable CharField(max_length=...) reference columns. */
const optionalIdField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`);

/** PositiveIntegerField upper bound (PostgreSQL integer). */
const MAX_HIERARCHY_LEVEL = 2147483647;

/**
 * Staff Hierarchy row, mirroring StaffHierarchy + StaffHierarchySerializer:
 * - governmentusertype_id required (CharField max_length=40)
 * - reports_to_governmentusertype_id optional (max_length=40), never the same
 *   role (serializer: "cannot report to itself")
 * - hierarchy_level a whole number >= 1 (PositiveIntegerField, 1 = lowest)
 * - scope ids optional (max_length=30); at most one local body
 */
export const staffHierarchySchema = z
  .object({
    governmentusertype_id: requiredString("Role").max(40, "Role must be at most 40 characters"),
    reports_to_governmentusertype_id: optionalIdField("Reports To", 40),
    hierarchy_level: z
      .string()
      .trim()
      .min(1, { message: "Level is required", abort: true })
      .regex(/^\d+$/, "Level must be a whole number")
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(1, "Level must be at least 1")
          .max(MAX_HIERARCHY_LEVEL, "Level is too large"),
      ),
    is_active: z.boolean(),
    escalation_enabled: z.boolean(),
    country_id: optionalIdField("Country", 30),
    state_id: optionalIdField("State", 30),
    district_id: optionalIdField("District", 30),
    area_type_id: optionalIdField("Area Type", 30),
    corporation_id: optionalIdField("Corporation", 30),
    municipality_id: optionalIdField("Municipality", 30),
    town_panchayat_id: optionalIdField("Town Panchayat", 30),
    panchayat_union_id: optionalIdField("Panchayat Union", 30),
    panchayat_id: optionalIdField("Panchayat", 30),
  })
  .superRefine((data, ctx) => {
    if (
      data.reports_to_governmentusertype_id &&
      data.reports_to_governmentusertype_id === data.governmentusertype_id
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reports_to_governmentusertype_id"],
        message: "A role cannot report to itself",
      });
    }
    const localBodies = [
      data.corporation_id,
      data.municipality_id,
      data.town_panchayat_id,
      data.panchayat_union_id,
      data.panchayat_id,
    ].filter(Boolean);
    if (localBodies.length > 1) {
      ctx.addIssue({ code: "custom", path: ["panchayat_id"], message: "Select only one local body" });
    }
  });

export type StaffHierarchyFormInput = z.input<typeof staffHierarchySchema>;
export type StaffHierarchyFormValues = z.output<typeof staffHierarchySchema>;
