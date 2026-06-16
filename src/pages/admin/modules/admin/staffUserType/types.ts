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
  category: "Staff" | "Contractor";
  usertype_name?: string;
};
