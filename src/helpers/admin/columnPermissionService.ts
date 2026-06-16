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
  staffusertype_id?: string;
  contractorusertype_id?: string;
  usertype_id?: string;
  is_active?: boolean;
  order_no?: number;
  company_id?: string;
}

export interface UpdateColumnPermissionPayload {
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Internal helper — reuses the auto-generated CrudHelpers instance
// ---------------------------------------------------------------------------

const _api = adminApi.columnPermissions;

const isContractorRoleId = (value: string): boolean =>
  value.trim().startsWith("CNTUSRTYPE-");

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Returns all column permissions for a specific screen + staff type.
 * Response is always grouped: { userscreen_id, column_permissions: [...] }
 */
export async function getColumnPermissions(
  userscreenId: string,
  staffuserTypeId: string,
  companyId?: string
): Promise<ColumnPermissionsResponse> {
  const roleParam = isContractorRoleId(staffuserTypeId)
    ? { contractorusertype_id: staffuserTypeId }
    : { staffusertype_id: staffuserTypeId };

  const result = await _api.readAll({
    params: {
      userscreen_id: userscreenId,
      ...roleParam,
      ...(companyId ? { company_id: companyId } : {}),
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
