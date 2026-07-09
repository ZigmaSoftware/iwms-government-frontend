import { api } from "@/api";
import type {
  DashboardWidget,
  FieldPermission,
  FieldPermissionState,
  ModulePermission,
  StaffAccessConfigPayload,
  StaffAccessConfigPreviewResponse,
} from "@/pages/admin/modules/staffMasters/staffAccessConfiguration/types";

type RawPermissionRow = {
  mainscreen_id?: string;
  mainScreenId?: string;
  mainscreen_name?: string;
  mainScreenName?: string;
  userscreen_id?: string;
  userScreenId?: string;
  userscreen_name?: string;
  userScreenName?: string;
  userscreenaction_id?: string;
  userScreenActionId?: string;
  action_id?: string;
  userscreenaction_name?: string;
  action_name?: string;
  actionName?: string;
};

type RawModule = {
  mainScreenId?: string;
  mainScreenName?: string;
  mainscreen_id?: string;
  mainscreen_name?: string;
  userScreens?: Array<{
    userScreenId?: string;
    userscreen_id?: string;
    userScreenName?: string;
    userscreen_name?: string;
    actions?: Array<string | {
      actionId?: string;
      action_id?: string;
      userscreenaction_id?: string;
      actionName?: string;
      action_name?: string;
    }>;
    actionIds?: string[];
  }>;
};

type RawMainScreen = {
  unique_id?: string;
  id?: string;
  mainscreen_name?: string;
  mainScreenName?: string;
  order_no?: number | string;
  is_deleted?: boolean;
};

type RawUserScreen = {
  unique_id?: string;
  id?: string;
  userscreen_name?: string;
  userScreenName?: string;
  mainscreen_id?: string | { unique_id?: string };
  mainscreen?: { unique_id?: string };
  order_no?: number | string;
  is_deleted?: boolean;
};

type RawUserScreenAction = {
  unique_id?: string;
  id?: string;
  action_name?: string;
  actionName?: string;
  name?: string;
  is_deleted?: boolean;
};

type StaffAccessMutationResponse = Record<string, unknown>;

export type StaffAccessConfigRecord = Record<string, unknown> & {
  basicInfo?: Partial<StaffAccessConfigPayload["basicInfo"]>;
  loginConfig?: Partial<StaffAccessConfigPayload["loginConfig"]> & {
    accountStatus?: string;
  };
  permissions?: Array<RawModule>;
  dashboardPermissions?: DashboardWidget[];
  dataScope?: Partial<StaffAccessConfigPayload["dataScope"]> & {
    corporationId?: string | null;
    municipalityId?: string | null;
    townPanchayatId?: string | null;
    panchayatUnionId?: string | null;
    panchayatId?: string | null;
  };
};

type BackendPreviewResponse = {
  valid?: boolean;
  summary?: {
    staffName?: string;
    username?: string;
    roleLabel?: string;
    permissionCount?: number;
    permissions?: number;
    scopeLabel?: string;
    basicInfo?: { employee_name?: string };
    loginConfig?: { username?: string };
  };
  errors?: Record<string, string>;
};

const DEFAULT_ACTION_NAMES = ["view", "add", "edit", "delete", "approve", "export"];

const emptyActions = () =>
  DEFAULT_ACTION_NAMES.reduce(
    (acc, key) => ({ ...acc, [key]: false }),
    {} as Record<string, boolean>,
  );

const normalizeActionName = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

const toId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return String((value as { unique_id?: unknown; id?: unknown }).unique_id ?? (value as { id?: unknown }).id ?? "").trim();
  }
  return String(value).trim();
};

const toOrder = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const getActionLabel = (action: RawUserScreenAction) =>
  String(action.action_name ?? action.actionName ?? action.name ?? action.unique_id ?? action.id ?? "");

const createActionLookup = (actions: RawUserScreenAction[]) => {
  const byName = new Map<string, string>();
  const validIds = new Set<string>();

  actions.forEach((action) => {
    const id = toId(action.unique_id ?? action.id);
    if (!id) return;
    validIds.add(id);
    byName.set(normalizeActionName(getActionLabel(action)), id);
  });

  DEFAULT_ACTION_NAMES.forEach((action) => {
    if (!byName.has(action)) byName.set(action, action);
    validIds.add(action);
  });

  return { byName, validIds };
};

const normalizeActionKey = (
  value: unknown,
  actionLookup: ReturnType<typeof createActionLookup>,
): string => {
  const id = toId(value);
  if (!id) return "";
  if (actionLookup.validIds.has(id)) return id;
  return actionLookup.byName.get(normalizeActionName(id)) ?? id;
};

const getPayload = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
};

const upsertModule = (
  map: Map<string, ModulePermission>,
  mainScreenId: string,
  mainScreenName: string,
) => {
  const existing = map.get(mainScreenId);
  if (existing) return existing;
  const module: ModulePermission = {
    mainScreenId,
    mainScreenName,
    enabled: true,
    screens: [],
  };
  map.set(mainScreenId, module);
  return module;
};

const upsertScreen = (
  module: ModulePermission,
  userScreenId: string,
  userScreenName: string,
) => {
  const existing = module.screens.find((screen) => screen.userScreenId === userScreenId);
  if (existing) return existing;
  const screen = {
    userScreenId,
    userScreenName,
    enabled: true,
    actions: emptyActions(),
    fieldPermissionState: "VISIBLE" as FieldPermissionState,
    fields: [] as FieldPermission[],
  };
  module.screens.push(screen);
  return screen;
};

type RawUserScreenColumn = {
  id?: string;
  unique_id?: string;
  fieldName?: string;
  field_name?: string;
  displayName?: string;
  display_name?: string;
};

type RawColumnPermission = {
  userscreencolumn_id?: string;
  column_name?: string;
  is_active?: boolean;
  field_permission_state?: FieldPermissionState;
};

const fetchScreenFields = async (userScreenId: string): Promise<RawUserScreenColumn[]> => {
  try {
    const { data } = await api.get(`/permissions/userscreen/${userScreenId}/columns/`);
    return getPayload<RawUserScreenColumn>(data);
  } catch {
    return [];
  }
};

const fetchColumnPermissions = async (
  userScreenId: string,
  governmentUserTypeId?: string,
): Promise<RawColumnPermission[]> => {
  if (!governmentUserTypeId) return [];
  try {
    const { data } = await api.get("/screen-managements/column-permissions/", {
      params: { userscreen_id: userScreenId, governmentusertype_id: governmentUserTypeId },
    });
    const record = data as { column_permissions?: RawColumnPermission[] };
    return Array.isArray(record?.column_permissions) ? record.column_permissions : [];
  } catch {
    return [];
  }
};

const attachScreenFields = async (
  modules: ModulePermission[],
  governmentUserTypeId?: string,
): Promise<ModulePermission[]> => {
  const screens = modules.flatMap((module) => module.screens);
  await Promise.all(
    screens.map(async (screen) => {
      const [columns, permissions] = await Promise.all([
        fetchScreenFields(screen.userScreenId),
        fetchColumnPermissions(screen.userScreenId, governmentUserTypeId),
      ]);
      const stateByColumnId = new Map(
        permissions.map((permission) => [
          permission.userscreencolumn_id,
          permission.field_permission_state ??
            (permission.is_active === false ? "HIDDEN" : "VISIBLE"),
        ]),
      );
      screen.fields = columns
        .map((column) => {
          const columnId = String(column.id ?? column.unique_id ?? "");
          if (!columnId) return null;
          return {
            columnId,
            fieldName: String(column.fieldName ?? column.field_name ?? ""),
            displayName: String(column.displayName ?? column.display_name ?? columnId),
            fieldPermissionState:
              (stateByColumnId.get(columnId) as FieldPermissionState) ?? "VISIBLE",
          };
        })
        .filter((field): field is FieldPermission => field !== null);
    }),
  );
  return modules;
};

const mapPermissionRows = (
  rows: RawPermissionRow[],
  actionLookup: ReturnType<typeof createActionLookup>,
): ModulePermission[] => {
  const modules = new Map<string, ModulePermission>();

  rows.forEach((row) => {
    const mainScreenId = String(row.mainScreenId ?? row.mainscreen_id ?? "");
    const userScreenId = String(row.userScreenId ?? row.userscreen_id ?? "");
    if (!mainScreenId || !userScreenId) return;

    const module = upsertModule(
      modules,
      mainScreenId,
      String(row.mainScreenName ?? row.mainscreen_name ?? "Untitled module"),
    );
    const screen = upsertScreen(
      module,
      userScreenId,
      String(row.userScreenName ?? row.userscreen_name ?? "Untitled screen"),
    );
    const action = normalizeActionKey(
      row.userScreenActionId ??
        row.userscreenaction_id ??
        row.action_id ??
        row.actionName ??
        row.userscreenaction_name ??
        row.action_name,
      actionLookup,
    );
    if (action) screen.actions[action] = true;
  });

  return Array.from(modules.values());
};

const buildPermissionModules = (
  mainScreens: RawMainScreen[],
  userScreens: RawUserScreen[],
  permissionRows: Array<RawPermissionRow | RawModule>,
  userScreenActions: RawUserScreenAction[],
): ModulePermission[] => {
  const modules = new Map<string, ModulePermission>();
  const actionLookup = createActionLookup(userScreenActions);

  mainScreens
    .filter((mainScreen) => !mainScreen.is_deleted)
    .sort((a, b) => toOrder(a.order_no) - toOrder(b.order_no))
    .forEach((mainScreen) => {
      const mainScreenId = toId(mainScreen.unique_id ?? mainScreen.id);
      if (!mainScreenId) return;
      upsertModule(
        modules,
        mainScreenId,
        String(mainScreen.mainscreen_name ?? mainScreen.mainScreenName ?? mainScreenId),
      );
    });

  userScreens
    .filter((screen) => !screen.is_deleted)
    .sort((a, b) => toOrder(a.order_no) - toOrder(b.order_no))
    .forEach((screen) => {
      const mainScreenId = toId(screen.mainscreen_id ?? screen.mainscreen?.unique_id);
      const userScreenId = toId(screen.unique_id ?? screen.id);
      if (!mainScreenId || !userScreenId) return;
      const module = upsertModule(modules, mainScreenId, "Untitled module");
      upsertScreen(
        module,
        userScreenId,
        String(screen.userscreen_name ?? screen.userScreenName ?? userScreenId),
      );
    });

  const savedModules = permissionRows.some((row) => "userScreens" in row)
    ? mapPermissionModules(permissionRows as RawModule[], actionLookup)
    : mapPermissionRows(permissionRows as RawPermissionRow[], actionLookup);

  savedModules.forEach((savedModule) => {
    const module = upsertModule(
      modules,
      savedModule.mainScreenId,
      savedModule.mainScreenName,
    );
    module.enabled = true;

    savedModule.screens.forEach((savedScreen) => {
      const screen = upsertScreen(
        module,
        savedScreen.userScreenId,
        savedScreen.userScreenName ?? savedScreen.userScreenId,
      );
      screen.enabled = true;
      screen.actions = { ...screen.actions, ...savedScreen.actions };
    });
  });

  return Array.from(modules.values()).filter((module) => module.screens.length > 0);
};

const mapPermissionModules = (
  rows: RawModule[],
  actionLookup: ReturnType<typeof createActionLookup>,
): ModulePermission[] => {
  return rows
    .map((module) => ({
      mainScreenId: String(module.mainScreenId ?? module.mainscreen_id ?? ""),
      mainScreenName: String(module.mainScreenName ?? module.mainscreen_name ?? "Untitled module"),
      enabled: true,
      screens: (module.userScreens ?? []).map((screen) => {
        const actions = emptyActions();
        [...(screen.actionIds ?? []), ...(screen.actions ?? [])].forEach((action) => {
          const key =
            typeof action === "string"
              ? normalizeActionKey(action, actionLookup)
              : normalizeActionKey(
                  action.actionId ??
                    action.action_id ??
                    action.userscreenaction_id ??
                    action.actionName ??
                    action.action_name,
                  actionLookup,
                );
          if (key) actions[key] = true;
        });
        return {
          userScreenId: String(screen.userScreenId ?? screen.userscreen_id ?? ""),
          userScreenName: String(screen.userScreenName ?? screen.userscreen_name ?? "Untitled screen"),
          enabled: true,
          actions,
          fieldPermissionState: "VISIBLE" as FieldPermissionState,
          fields: [] as FieldPermission[],
        };
      }),
    }))
    .filter((module) => module.mainScreenId);
};

const toBackendPayload = (payload: StaffAccessConfigPayload) => {
  return {
    basicInfo: {
      employee_name: payload.basicInfo.employeeName,
      contact_email: payload.basicInfo.officeEmail || null,
      department_id: payload.basicInfo.departmentId || null,
      designation_id: payload.basicInfo.designationId || null,
      doj: payload.basicInfo.doj || null,
      active_status: payload.basicInfo.activeStatus,
      contact_mobile: payload.basicInfo.mobileNumber,
    },
    loginConfig: {
      username: payload.loginConfig.username,
      password: payload.loginConfig.password,
      confirmPassword: payload.loginConfig.confirmPassword,
      userTypeId: payload.loginConfig.userTypeId,
      governmentUserTypeId: payload.loginConfig.governmentUserTypeId,
      accountStatus: payload.loginConfig.loginEnabled ? "ACTIVE" : "INACTIVE",
    },
    permissions: payload.permissions
      .filter((module) => module.enabled)
      .map((module) => ({
        mainScreenId: module.mainScreenId,
        userScreens: module.screens
          .map((screen) => ({
            userScreenId: screen.userScreenId,
            actionIds: Object.entries(screen.actions)
              .filter(([, enabled]) => enabled)
              .map(([action]) => action),
            columns: screen.fields.map((field) => ({
              columnId: field.columnId,
              fieldName: field.fieldName,
              canView: field.fieldPermissionState !== "HIDDEN",
              fieldPermissionState: field.fieldPermissionState,
            })),
          }))
          .filter((screen) => screen.actionIds.length > 0 || screen.columns.length > 0),
      }))
      .filter((module) => module.userScreens.length > 0),
    dashboardPermissions: payload.dashboardPermissions,
    dataScope: {
      stateId: payload.dataScope.stateId,
      districtId: payload.dataScope.districtId,
      areaTypeId: payload.dataScope.areaTypeId,
      corporationId:
        payload.dataScope.localBodyLevel === "corporation_id" ? payload.dataScope.localBodyId : null,
      municipalityId:
        payload.dataScope.localBodyLevel === "municipality_id" ? payload.dataScope.localBodyId : null,
      townPanchayatId:
        payload.dataScope.localBodyLevel === "town_panchayat_id" ? payload.dataScope.localBodyId : null,
      panchayatUnionId:
        payload.dataScope.localBodyLevel === "panchayat_union_id" ? payload.dataScope.localBodyId : null,
      panchayatId:
        payload.dataScope.localBodyLevel === "panchayat_id" ? payload.dataScope.localBodyId : null,
      depotId: payload.dataScope.depotId,
      vehicleId: payload.dataScope.vehicleId,
    },
  };
};

const normalizePreviewResponse = (
  response: BackendPreviewResponse,
  payload: StaffAccessConfigPayload,
): StaffAccessConfigPreviewResponse => {
  const selectedPermissionCount = payload.permissions.reduce(
    (total, module) =>
      total +
      module.screens.filter(
        (screen) =>
          module.enabled &&
          screen.enabled &&
          Object.values(screen.actions).some(Boolean),
      ).length,
    0,
  );

  return {
    valid: Boolean(response?.valid ?? true),
    summary: {
      staffName:
        response?.summary?.staffName ??
        response?.summary?.basicInfo?.employee_name ??
        payload.basicInfo.employeeName,
      username:
        response?.summary?.username ??
        response?.summary?.loginConfig?.username ??
        payload.loginConfig.username,
      roleLabel:
        response?.summary?.roleLabel ??
        payload.loginConfig.governmentUserTypeId ??
        "Not selected",
      permissionCount:
        response?.summary?.permissionCount ??
        response?.summary?.permissions ??
        selectedPermissionCount,
      scopeLabel:
        response?.summary?.scopeLabel ??
        (payload.dataScope.localBodyId || payload.dataScope.districtId
          ? "Location scoped"
          : "No location scope"),
    },
    errors: response?.errors,
  };
};

export async function createStaffAccess(
  payload: StaffAccessConfigPayload,
): Promise<StaffAccessMutationResponse> {
  const { data } = await api.post(
    "/user-creations/staff-access-configuration/",
    toBackendPayload(payload),
  );
  return data;
}

export async function updateStaffAccess(
  id: string,
  payload: StaffAccessConfigPayload,
): Promise<StaffAccessMutationResponse> {
  const { data } = await api.put(
    `/user-creations/staff-access-configuration/${id}/`,
    toBackendPayload(payload),
  );
  return data;
}

export async function fetchStaffAccess(id: string): Promise<StaffAccessConfigRecord> {
  const { data } = await api.get(`/user-creations/staff-access-configuration/${id}/`);
  return data as StaffAccessConfigRecord;
}

export async function previewStaffAccess(
  payload: StaffAccessConfigPayload,
): Promise<StaffAccessConfigPreviewResponse> {
  const { data } = await api.post(
    "/user-creations/staff-access-configuration/preview/",
    toBackendPayload(payload),
  );
  return normalizePreviewResponse(data, payload);
}

export async function fetchPermissionTree(governmentUserTypeId?: string): Promise<ModulePermission[]> {
  const [permissionRes, mainScreenRes, userScreenRes, userScreenActionRes] = await Promise.all([
    api.get("/screen-managements/userscreenpermissions/", {
      params: {
        ...(governmentUserTypeId ? { governmentusertype_id: governmentUserTypeId } : {}),
        limit: 6000,
        offset: 0,
      },
    }),
    api.get("/screen-managements/mainscreens/", {
      params: { limit: 6000, offset: 0 },
    }),
    api.get("/screen-managements/userscreens/", {
      params: { limit: 6000, offset: 0 },
    }),
    api.get("/screen-managements/userscreen-action/", {
      params: { limit: 6000, offset: 0 },
    }),
  ]);
  const rows = governmentUserTypeId
    ? getPayload<RawPermissionRow | RawModule>(permissionRes.data)
    : [];
  const modules = buildPermissionModules(
    getPayload<RawMainScreen>(mainScreenRes.data),
    getPayload<RawUserScreen>(userScreenRes.data),
    rows,
    getPayload<RawUserScreenAction>(userScreenActionRes.data),
  );
  return attachScreenFields(modules, governmentUserTypeId);
}

export async function fetchUserScreenActions() {
  const { data } = await api.get("/screen-managements/userscreen-action/", {
    params: { limit: 6000, offset: 0 },
  });
  const actions = getPayload<RawUserScreenAction>(data)
    .filter((action) => !action.is_deleted)
    .map((action) => ({
      value: toId(action.unique_id ?? action.id),
      label: getActionLabel(action),
    }))
    .filter((action) => action.value && action.label);

  return actions.length
    ? actions
    : DEFAULT_ACTION_NAMES.map((action) => ({ value: action, label: action }));
}
