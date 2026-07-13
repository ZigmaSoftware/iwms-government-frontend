import { adminApi } from "./registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnPermissionEntry {
  userscreencolumnpermission_id: string;
  userscreencolumn_id: string;
  column_name: string;
  is_active: boolean;
}

export interface ColumnPermissionsResponse {
  userscreen_id: string;
  column_permissions: ColumnPermissionEntry[];
}

export interface CreateColumnPermissionPayload {
  userscreen_id: string;
  column_id: string;
  local_body_type: string;
  local_body_id: string;
  state_id?: string;
  district_id?: string;
  area_type_id?: string;
  is_active?: boolean;
  order_no?: number;
}

export interface UpdateColumnPermissionPayload {
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Internal helper — reuses the auto-generated CrudHelpers instance
// ---------------------------------------------------------------------------

const _api = adminApi.columnPermissions;

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Returns all column permissions for a specific screen + Local Body.
 * Response is always grouped: { userscreen_id, column_permissions: [...] }
 */
export async function getColumnPermissions(
  userscreenId: string,
  localBodyId: string,
  options: { localBodyType: string }
): Promise<ColumnPermissionsResponse> {
  const result = await _api.readAll({
    params: {
      userscreen_id: userscreenId,
      local_body_type: options.localBodyType,
      local_body_id: localBodyId,
    },
  });
  // Backend returns { userscreen_id, column_permissions } — cast from the
  // generic T[] return type used by CrudHelpers.
  return result as unknown as ColumnPermissionsResponse;
}

/**
 * Creates a column permission. Uses get_or_create on the backend, so calling
 * this for an existing record updates can_view instead of creating a duplicate.
 */
export async function createColumnPermission(
  payload: CreateColumnPermissionPayload
): Promise<ColumnPermissionsResponse> {
  return _api.create(payload) as Promise<ColumnPermissionsResponse>;
}

/**
 * Updates an existing column permission (toggling is_active / can_view).
 * Never creates a new record.
 */
export async function updateColumnPermission(
  permissionId: string,
  payload: UpdateColumnPermissionPayload
): Promise<ColumnPermissionsResponse> {
  return _api.update(permissionId, payload) as Promise<ColumnPermissionsResponse>;
}
