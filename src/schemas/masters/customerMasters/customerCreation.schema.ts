import { z } from "zod";

import {
  emailField,
  latitudeField,
  longitudeField,
  mobileField,
  optionalString,
  pincodeField,
  requiredString,
} from "@/schemas/shared/fields";

/**
 * Mirrors the manual `validateForm()` checks already in customerCreationForm.tsx
 * (the unconditional `requiredFields` list, the format checks that follow it,
 * and the family-member/member-count cross check) so they can also be enforced
 * through a single Zod safeParse before the API call. This does not replace
 * `validateForm()` — that check still runs first and is permission-aware via
 * `showField`; this schema formalises the underlying business rule.
 */

const SQFT_MESSAGE = "Please enter a valid square feet value";
const sqftField = z.coerce.number({ error: SQFT_MESSAGE }).positive(SQFT_MESSAGE);

const nonNegativeIfPresent = (label: string) =>
  optionalString.refine(
    (value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0),
    { message: `Please enter a valid ${label} value` },
  );

// Mirrors the form's own PASSWORD_PATTERN: 8-12 chars, upper + lower + special.
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8,12}$/;
const PASSWORD_RULE_MESSAGE =
  "Password must be 8-12 characters long and include at least one uppercase letter, one lowercase letter, and one special character.";

const familyMemberSchema = z.object({
  member_name: z.string(),
  id_proof_type: z.string(),
  id_no: z.string(),
});

export const customerCreationSchema = z
  .object({
    customer_name: requiredString("Customer Name"),
    contact_no: mobileField,
    username: requiredString("Username"),
    email: emailField,
    // Required only when creating (enforced by the form's own isEdit check);
    // when present here it must satisfy the password policy either way.
    password: optionalString.refine((value) => !value || PASSWORD_PATTERN.test(value), {
      message: PASSWORD_RULE_MESSAGE,
    }),
    building_no: optionalString,
    street: optionalString,
    area: optionalString,
    pincode: pincodeField,
    latitude: latitudeField,
    longitude: longitudeField,
    sqft: sqftField,
    water_consumption_lpd: nonNegativeIfPresent("water consumption"),
    waste_collection_kg_per_day: nonNegativeIfPresent("waste collection"),
    property_id: requiredString("Property"),
    sub_property_id: requiredString("Sub Property"),
    waste_type_ids: z.array(z.string()).min(1, "Waste Type is required"),
    id_proof_type: requiredString("ID Proof Type"),
    id_no: requiredString("ID Number"),
    member_count: optionalString,
    family_members: z.array(familyMemberSchema),
    country_id: optionalString,
    state_id: requiredString("State"),
    district_id: requiredString("District"),
    area_type_id: requiredString("Area Type"),
    location_node_id: optionalString,
    corporation_id: optionalString,
    municipality_id: optionalString,
    town_panchayat_id: optionalString,
    panchayat_union_id: optionalString,
    panchayat_id: optionalString,
    is_active: z.boolean(),
    is_bulkwaste_generator: z.boolean(),
    apartment_name: optionalString,
    block_no: optionalString,
    flat_no: optionalString,
    villa_no: optionalString,
    industry_name: optionalString,
    industry_type: optionalString,
  })
  .superRefine((data, ctx) => {
    const hasLocalBody = [
      data.corporation_id,
      data.municipality_id,
      data.town_panchayat_id,
      data.panchayat_union_id,
      data.panchayat_id,
    ].some((value) => value.trim());
    if (!hasLocalBody) {
      ctx.addIssue({
        code: "custom",
        path: ["corporation_id"],
        message: "Local body is required",
      });
    }

    const filledFamilyMemberCount = data.family_members.filter(
      (m) => m.member_name.trim() || m.id_proof_type.trim() || m.id_no.trim(),
    ).length;
    if (filledFamilyMemberCount > 0) {
      const memberCount = parseInt(data.member_count, 10);
      const allowedCount = Number.isNaN(memberCount) ? 0 : memberCount;
      if (filledFamilyMemberCount > allowedCount) {
        ctx.addIssue({
          code: "custom",
          path: ["family_members"],
          message: `Family member ID proof rows (${filledFamilyMemberCount}) cannot exceed the Member Count (${allowedCount}).`,
        });
      }
    }
  });

export type CustomerCreationFormValues = z.infer<typeof customerCreationSchema>;
