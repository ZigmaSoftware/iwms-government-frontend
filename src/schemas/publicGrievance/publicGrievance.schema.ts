import { z } from "zod";

import {
  emailField,
  latitudeField,
  longitudeField,
  mobileField,
  requiredString,
} from "@/schemas/shared/fields";

/**
 * Public (no-login) grievance flows: the 4-step complaint wizard, the status
 * lookup and the "Verify Cleanup" photo on the public map. The wizard keeps
 * its fields in plain component state, so each step is checked with
 * `safeParse` and the first issue is shown in the step's error banner.
 */

export const GRIEVANCE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Matches CLEANUP_MAX_BYTES in the backend's app/utils/public_grievance_map.py. */
export const CLEANUP_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const GRIEVANCE_DESCRIPTION_MAX = 1000;
/** Matches CLEANUP_NOTE_MAX in the backend. */
export const CLEANUP_NOTE_MAX = 500;
const PERSON_NAME_MAX = 100;
const ADDRESS_PART_MAX = 255;

/** Optional image upload; pass `requiredMessage` to make it mandatory. */
const imageFile = (maxBytes: number, sizeLabel: string, requiredMessage?: string) =>
  z
    .instanceof(File)
    .nullable()
    .superRefine((file, ctx) => {
      if (!file) {
        if (requiredMessage) ctx.addIssue({ code: "custom", message: requiredMessage });
        return;
      }
      if (!file.type.startsWith("image/")) {
        ctx.addIssue({ code: "custom", message: "Only image files are allowed." });
      } else if (file.size > maxBytes) {
        ctx.addIssue({ code: "custom", message: `The photo must be ${sizeLabel} or smaller.` });
      }
    });

export const grievanceDetailsSchema = z
  .object({
    personName: requiredString("Name").max(PERSON_NAME_MAX, `Name must be at most ${PERSON_NAME_MAX} characters`),
    gender: z.enum(["male", "female", "transgender"], { error: "Please select your gender." }),
    shareMobile: z.boolean(),
    phone: z.string(),
    shareEmail: z.boolean(),
    email: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.shareMobile) {
      const result = mobileField.safeParse(data.phone);
      if (!result.success) ctx.addIssue({ code: "custom", path: ["phone"], message: result.error.issues[0].message });
    }
    if (data.shareEmail) {
      const result = emailField.safeParse(data.email);
      if (!result.success) ctx.addIssue({ code: "custom", path: ["email"], message: result.error.issues[0].message });
    }
  });

/** The map pin keeps coordinates as strings; blank means no pin dropped yet. */
const pinnedCoordinate = (field: z.ZodType, rangeMessage: string) =>
  z
    .string()
    .trim()
    .min(1, "Please pin the complaint location on the map.")
    .refine((value) => field.safeParse(value).success, rangeMessage);

export const grievanceLocationSchema = z.object({
  latitude: pinnedCoordinate(latitudeField, "Latitude must be between -90 and 90"),
  longitude: pinnedCoordinate(longitudeField, "Longitude must be between -180 and 180"),
  street: z.string().trim().max(ADDRESS_PART_MAX, `Street must be at most ${ADDRESS_PART_MAX} characters`),
  landmark: z.string().trim().max(ADDRESS_PART_MAX, `Landmark must be at most ${ADDRESS_PART_MAX} characters`),
});

export const grievanceComplaintSchema = z
  .object({
    categoryId: z.string().min(1, "Please select a complaint type."),
    subcategoryId: z.string(),
    /** true when the chosen complaint type has sub-types to pick from */
    hasSubcategories: z.boolean(),
    description: requiredString("Complaint details").max(
      GRIEVANCE_DESCRIPTION_MAX,
      `Complaint details must be at most ${GRIEVANCE_DESCRIPTION_MAX} characters`,
    ),
    photo: imageFile(GRIEVANCE_PHOTO_MAX_BYTES, "5 MB"),
  })
  .refine((data) => !data.hasSubcategories || data.subcategoryId, {
    path: ["subcategoryId"],
    message: "Please select a complaint sub-type.",
  });

export const grievanceStatusSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ticket"),
    query: z.string().trim().min(1, "Enter a complaint number."),
  }),
  z.object({
    mode: z.literal("mobile"),
    query: mobileField,
  }),
]);

export const cleanupVerificationSchema = z.object({
  photo: imageFile(CLEANUP_PHOTO_MAX_BYTES, "8 MB", "Add a photo of the cleaned spot."),
  note: z.string().trim().max(CLEANUP_NOTE_MAX, `Note must be at most ${CLEANUP_NOTE_MAX} characters`),
});

/** First issue's message, for the single-line error banners these flows use. */
export const firstIssueMessage = (error: z.ZodError) => error.issues[0]?.message ?? "Please check the form.";
