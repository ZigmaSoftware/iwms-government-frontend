export type StaffUserType = {
  unique_id?: unknown;
  name?: unknown;
  name_display?: unknown;
  level?: unknown;
  level_display?: unknown;
  usertype_id?: unknown;
  usertype?: { unique_id?: unknown };
  [key: string]: unknown;
};

export type MainScreen = {
  unique_id?: unknown;
  mainscreen_name?: unknown;
  [key: string]: unknown;
};

export type UserScreenAction = {
  unique_id?: unknown;
  action_name?: unknown;
  [key: string]: unknown;
};

export type Option = {
  value: string;
  label: string;
  userTypeId?: string;
  governmentLevel?: string;
  governmentLevelLabel?: string;
};

export type PermissionScreen = {
  userscreen_id: string;
  userscreen_name?: string;
  /** API returns actionIds (not actions) */
  actionIds?: string[];
  /** Backward-compat alias some callers may use */
  actions?: string[];
  /** Saved column permissions */
  columnIds?: string[];
};

export type PermissionResponse = {
  screens: PermissionScreen[];
  description?: string;
};

export type ScreenMatrixRow = {
  userscreen_id: string;
  userscreen_name: string;
  actions: string[];
  columnIds: string[];
};

export type ApiUserScreen = {
  unique_id?: string;
  userscreen_name?: string;
  mainscreen_id?: string;
  order_no?: number;
  is_active?: boolean;
  is_deleted?: boolean;
  [key: string]: unknown;
};

export type UserScreenColumnRecord = {
  unique_id: string;
  field_name: string;
  display_name: string;
  data_type: string;
  order_no: number;
  is_required: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
};
