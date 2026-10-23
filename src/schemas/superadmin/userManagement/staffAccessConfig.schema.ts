import { z } from "zod";
import {
  CONFIRM_PASSWORD_MESSAGE,
  EMAIL_MESSAGE,
  mobileField,
  optionalString,
  passwordField,
  requiredString,
} from "@/schemas/shared/fields";

export type StaffAccessConfigSchemaOptions = {
  isEdit: boolean;
  initialPassword?: string;
  isStateScope: boolean;
};

const LOCAL_BODY_LEVELS = [
  "corporation_id",
  "municipality_id",
  "town_panchayat_id",
  "panchayat_union_id",
  "panchayat_id",
] as const;

/** Blank-or-valid email that keeps a plain `string` type (form state always supplies the key). */
const optionalEmailString = z
  .string()
  .trim()
  .max(254, "Email must be at most 254 characters")
  .refine((value) => !value || z.email().safeParse(value).success, {
    message: EMAIL_MESSAGE,
  });

export const buildStaffAccessConfigSchema = ({
  isEdit,
  initialPassword = "",
  isStateScope,
}: StaffAccessConfigSchemaOptions) =>
  z
    .object({
      // Basic Info
      employeeName: requiredString("Employee Name").max(
        200,
        "Employee Name must be at most 200 characters",
      ),
      mobileNumber: requiredString("Mobile Number").pipe(mobileField),
      officeEmail: optionalEmailString,
      doj: optionalString,
      activeStatus: z.boolean(),

      // Login
      username: requiredString("Username").max(150, "Username must be at most 150 characters"),
      password: z.string(),
      confirmPassword: z.string(),
      userTypeId: requiredString("User Type"),
      governmentUserTypeId: requiredString("Government User Type"),
      loginEnabled: z.boolean(),
      // Data Scope
      stateId: optionalString,
      districtId: optionalString,
      areaTypeId: optionalString,
      localBodyLevels: z.array(z.enum(LOCAL_BODY_LEVELS)),
      localBodies: z.array(z.object({ level: z.enum(LOCAL_BODY_LEVELS), id: z.string() })),
      wardIds: z.array(z.string()),
    })
    .superRefine((data, ctx) => {
      const { password, confirmPassword } = data;

      if (!isEdit && !password) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "Password is required" });
      } else if (password && (!isEdit || password !== initialPassword)) {
        const result = passwordField.safeParse(password);
        if (!result.success) {
          ctx.addIssue({
            code: "custom",
            path: ["password"],
            message: result.error.issues[0].message,
          });
        }
      }

      if (!isEdit && !confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "Confirm Password is required",
        });
      } else if ((password || confirmPassword) && password !== confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: CONFIRM_PASSWORD_MESSAGE });
      }

      // State is always the minimum boundary; District too unless the
      // government level is State-wide. Area Type / Local Body / Ward are
      // optional narrowing on top of that boundary.
      if (!data.stateId) {
        ctx.addIssue({ code: "custom", path: ["stateId"], message: "State is required" });
      }
      if (!isStateScope && !data.districtId) {
        ctx.addIssue({ code: "custom", path: ["districtId"], message: "District is required" });
      }
    });

export type StaffAccessConfigFormValues = z.infer<ReturnType<typeof buildStaffAccessConfigSchema>>;
