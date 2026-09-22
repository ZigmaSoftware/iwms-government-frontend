export type PermissionAuditRecord = {
  id?: number;
  staffusertype?: string | null;
  staffusertype_name?: string | null;
  usertype?: string | null;
  contractorusertype?: string | null;
  governmentusertype?: string | null;
  permission_owner_kind?: string | null;
  local_body_type?: string | null;
  local_body_id?: string | null;
  staff_id?: string | null;
  role_display?: string | null;
  mainscreen?: string | null;
  mainscreen_name?: string | null;
  userscreen?: string | null;
  userscreen_name?: string | null;
  userscreenaction?: string | null;
  userscreenaction_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  is_active?: boolean | null;
  is_deleted?: boolean | null;
  previous_is_active?: boolean | null;
  previous_is_deleted?: boolean | null;
  action_type?: "CREATED" | "UPDATED" | "DELETED" | string;
  timestamp?: string;
  [key: string]: unknown;
};

export type StaffUserTypeOption = {
  label: string;
  value: string;
};
