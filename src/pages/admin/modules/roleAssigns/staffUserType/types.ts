import type { StaffUserType } from "@/pages/admin/modules/screenManagements/shared/adminTypes";

export type RoleTypeOption = {
  value: string;
  label: string;
};

export type UserType = {
  unique_id: string;
  name: string;
  is_active: boolean;
};

export type StaffUserTypeRow = StaffUserType & {
  category: "Staff" | "Contractor" | "Government";
  usertype_name?: string;
  level?: string;
  level_display?: string;
};
