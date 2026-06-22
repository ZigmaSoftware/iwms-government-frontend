import type { StaffUserType } from "../types/admin.types";

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
