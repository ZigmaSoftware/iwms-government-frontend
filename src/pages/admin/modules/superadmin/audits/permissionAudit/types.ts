export type SnapshotItem = { id: string; name: string };

/** A column grant: visible in every field_permission_state except HIDDEN. */
export type SnapshotColumn = SnapshotItem & { state?: string | null };

/** Whole access before/after one save (app/utils/permission_snapshot.py). */
export type AccessSnapshot = {
  app_modules: SnapshotItem[];
  modules: {
    id: string | null;
    name: string;
    screens: {
      id: string;
      name: string;
      actions: SnapshotItem[];
      columns?: SnapshotColumn[];
    }[];
  }[];
  widgets?: SnapshotItem[];
};

export type PermissionAuditRecord = {
  id?: number;
  /** LOCAL_BODY_SCREEN / ROLE_SCREEN / STAFF_ACCESS / CUSTOMER_ACCESS for
   *  one row per save; GRANT_CHANGE for older per-grant rows. */
  source?: string;
  source_label?: string | null;
  target_id?: string | null;
  target_name?: string | null;
  staffusertype_id?: string | null;
  staffusertype_name?: string | null;
  usertype_id?: string | null;
  contractorusertype_id?: string | null;
  governmentusertype_id?: string | null;
  governmentusertype_name?: string | null;
  permission_owner_kind?: string | null;
  state_id?: string | null;
  district_id?: string | null;
  area_type_id?: string | null;
  local_body_type?: string | null;
  local_body_id?: string | null;
  local_body_name?: string | null;
  staff_id?: string | null;
  role_display?: string | null;
  mainscreen_id?: string | null;
  mainscreen_name?: string | null;
  userscreen_id?: string | null;
  userscreen_name?: string | null;
  userscreenaction_id?: string | null;
  userscreenaction_name?: string | null;
  updated_by_id?: string | null;
  updated_by_name?: string | null;
  is_active?: boolean | null;
  is_deleted?: boolean | null;
  previous_is_active?: boolean | null;
  previous_is_deleted?: boolean | null;
  action_type?: "CREATED" | "UPDATED" | "DELETED" | string;
  http_method?: string | null;
  /** Only on the detail endpoint; blank on per-grant rows. */
  old_permissions?: AccessSnapshot | null;
  new_permissions?: AccessSnapshot | null;
  /** Null on per-grant rows. */
  granted_count?: number | null;
  revoked_count?: number | null;
  changed_modules?: string[] | null;
  timestamp?: string;
  [key: string]: unknown;
};

export type PermissionAuditFilterOption = {
  unique_id: string;
  name: string;
};

export type PermissionAuditFilterOptions = {
  sources: PermissionAuditFilterOption[];
  local_bodies: (PermissionAuditFilterOption & { local_body_type?: string })[];
  mainscreens: PermissionAuditFilterOption[];
};
