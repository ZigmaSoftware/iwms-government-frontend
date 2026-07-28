import { z } from "zod";
import {
  optionalEmailField,
  optionalMobileField,
  optionalPincodeField,
  optionalString,
  passwordField,
  requiredString,
} from "@/schemas/shared/fields";

/**
 * Staff Creation main form. Only `employee_name` (the sole field carrying an
 * HTML `required` attribute in the component) and `username`/`governmentusertype_id`
 * (the login identity and the role that drives the staff-head/access-level
 * logic downstream) are treated as mandatory — every other office/personal/
 * address field has no required-ness signal in the component today, so it
 * stays optional here and only gets format validation where the field has an
 * obvious shape (email, mobile, pincode). `password` is the initial-login
 * password: required only when creating a new staff record (mirrors the
 * `buildDistrictLeaderSchema` isEdit idiom) since editing leaves it blank to
 * keep the current password, per the component's own placeholder/hint text.
 */
export const buildStaffCreationSchema = (isEdit: boolean) =>
  z
    .object({
      employee_name: requiredString("Employee Name"),
      doj: optionalString,
      department: optionalString,
      designation: optionalString,
      department_id: optionalString,
      staff_head: optionalString,
      staff_head_id: optionalString,
      active_status: optionalString,
      staffusertype_id: optionalString,
      contractorusertype_id: optionalString,
      governmentusertype_id: requiredString("Government Staff User Type"),
      state_id: optionalString,
      district_id: optionalString,
      area_type_id: optionalString,
      local_body_level: optionalString,
      local_body_id: optionalString,
      username: requiredString("Username"),
      password: optionalString,
      login_enabled: optionalString,
      marital_status: optionalString,
      dob: optionalString,
      blood_group: optionalString,
      gender: optionalString,
      physically_challenged: optionalString,
      present_country: optionalString,
      present_state: optionalString,
      present_district: optionalString,
      present_city: optionalString,
      present_building_no: optionalString,
      present_street: optionalString,
      present_area: optionalString,
      present_pincode: optionalPincodeField,
      permanent_country: optionalString,
      permanent_state: optionalString,
      permanent_district: optionalString,
      permanent_city: optionalString,
      permanent_building_no: optionalString,
      permanent_street: optionalString,
      permanent_area: optionalString,
      permanent_pincode: optionalPincodeField,
      contact_mobile: optionalMobileField,
      contact_email: optionalEmailField,
      driving_licence_no: optionalString,
      driving_licence_expiry_date: optionalString,
      driving_experience_years: optionalString,
    })
    .superRefine((data, ctx) => {
      if (!isEdit && !data.password.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password is required when creating a new staff member.",
        });
        return;
      }
      if (data.password) {
        const result = passwordField.safeParse(data.password);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: result.error.issues[0].message,
          });
        }
      }
    });

export type StaffCreationFormValues = z.infer<
  ReturnType<typeof buildStaffCreationSchema>
>;
