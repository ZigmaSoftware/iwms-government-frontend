export type GovernmentRoleOption = {
  unique_id: string;
  name: string;
  name_display?: string;
  level?: string;
  level_display?: string;
  is_active?: boolean;
};

export type StaffHierarchyRow = {
  unique_id: string;
  governmentusertype_id: string;
  governmentusertype_name?: string | null;
  governmentusertype_level?: string | null;
  reports_to_governmentusertype_id: string | null;
  reports_to_governmentusertype_name?: string | null;
  reports_to_governmentusertype_level?: string | null;
  hierarchy_level: number;
  scope_label?: string | null;
  scope_level?: string | null;
  is_active: boolean;
};
