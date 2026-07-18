import { api } from "@/api";
import type {
  DashboardWidget,
  ModulePermission,
  StaffAccessConfigPayload,
  StaffAccessConfigPreviewResponse,
} from "@/pages/admin/modules/userCreations/staffAccessConfiguration/types";

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

type RawMainScreen = {
  unique_id?: string;
  id?: string;
  mainscreen_name?: string;
  mainScreenName?: string;
  order_no?: number | string;
  is_deleted?: boolean;
};

const APP_SIDEBAR_PERMISSION_CATALOG: Array<{ module: string; screens: string[] }> = [
  { module: "dashboard", screens: ["Dashboard"] },
  { module: "common-masters", screens: ["continents", "countries", "states"] },
  {
    module: "masters",
    screens: [
      "districts",
      "area-types",
      "corporations",
      "municipalities",
      "town-panchayats",
      "panchayat-unions",
      "panchayats",
    ],
  },
  { module: "waste-types", screens: ["properties", "subproperties"] },
  { module: "assets", screens: ["bins", "wastetypes"] },
  {
    module: "screen-managements",
    screens: [
      "mainscreentype",
      "mainscreens",
      "userscreens",
      "userscreen-action",
      "userscreenpermissions",
    ],
  },
  { module: "role-assigns", screens: ["user-type", "staff-user-type"] },
  { module: "user-creations", screens: ["staffcreation", "staff-access-configuration"] },
  { module: "customers", screens: ["customercreations", "feedbacks"] },
  {
    module: "complaint-ticket",
    screens: [
      "tickets",
      "modules",
      "categories",
      "subcategories",
      "priorities",
      "statuses",
      "sources",
      "teams",
      "sla-rules",
      "feedback",
    ],
  },
  { module: "transport-masters", screens: ["vehicle-type", "vehicle-creation", "fuels"] },
  {
    module: "schedule-masters",
    screens: [
      "staff-templates",
      "alternative-staff-templates",
      "collection-points",
      "trip-plans",
      "daily-trip-assignments",
      "daily-trip-collection-points",
      "daily-trip-household-collections",
      "bin-collection-events",
      "vehicle-breakdowns",
      "daily-trip-logs",
      "wastecollections",
      "daily-waste-comparisons",
      "MonthlyWasteComparison",
    ],
  },
  { module: "audits", screens: ["common-audit", "login-audit"] },
  {
    module: "vehicle-tracking",
    screens: ["VehicleTrack", "VehicleHistory"],
  },
  {
    module: "reports",
    screens: ["TripSummary", "MonthlyDistance", "WasteCollectedSummary"],
  },
  { module: "workforce", screens: ["WorkforceManagement"] },
  { module: "leader-login", screens: ["plb-leader-creation", "district-leader-creation"] },
];

const catalogKey = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const catalogAliases = (value: string) => {
  const normalized = catalogKey(value);
  const aliases = new Set([normalized]);
  aliases.add(catalogKey(value.replace(/s$/, "")));
  aliases.add(catalogKey(value.replace(/-/g, "")));
  aliases.add(catalogKey(value.replace(/-/g, "_")));
  if (normalized === "wastetypes") aliases.add("wastetypes");
  if (normalized === "mainscreentype") aliases.add("mainscreentype");
  return aliases;
};

export type RawUserScreenAction = {
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

const DEFAULT_ACTION_NAMES = ["view", "add", "edit", "delete"];

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

const getActionLabel = (action: RawUserScreenAction) =>
  String(action.action_name ?? action.actionName ?? action.name ?? action.unique_id ?? action.id ?? "");

export const createActionLookup = (actions: RawUserScreenAction[]) => {
  const byName = new Map<string, string>();
  const validIds = new Set<string>();
  // Reverse map: action unique_id -> canonical literal name (e.g. "edit").
  // Needed because upstream responses (e.g. all-screens-by-staff) return
  // action unique_ids, not literal names — without this, an id-based action
  // would never resolve down to the "edit"/"show" key that ModulePermission
  // screens/allowedActions are keyed by.
  const nameById = new Map<string, string>();

  actions.forEach((action) => {
    const id = toId(action.unique_id ?? action.id);
    if (!id) return;
    validIds.add(id);
    const literalName = normalizeActionName(getActionLabel(action));
    byName.set(literalName, id);
    if (DEFAULT_ACTION_NAMES.includes(literalName)) {
      nameById.set(id, literalName);
    }
  });

  DEFAULT_ACTION_NAMES.forEach((action) => {
    if (!byName.has(action)) byName.set(action, action);
    validIds.add(action);
  });

  return { byName, validIds, nameById };
};

const normalizeActionKey = (
  value: unknown,
  actionLookup: ReturnType<typeof createActionLookup>,
): string => {
  const id = toId(value);
  if (!id) return "";
  const canonicalName = actionLookup.nameById.get(id);
  if (canonicalName) return canonicalName;
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

/**
 * Parses a saved staff record's `permissions` (RawModule[], as returned by
 * fetchStaffAccess) into ModulePermission[] — used on edit to seed the
 * staff's previous selections before intersecting with the current
 * Super-Admin-enabled ceiling via `applyAllowedActionsCeiling`.
 */
export const mapPermissionModules = (
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
        };
      }),
    }))
    .filter((module) => module.mainScreenId);
};

const toBackendPayload = (payload: StaffAccessConfigPayload) => {
  return {
    basicInfo: {
      employee_name: payload.basicInfo.employeeName,
      staff_config_name: payload.basicInfo.staffConfigName,
      contact_email: payload.basicInfo.officeEmail || null,
      department_id: payload.basicInfo.departmentId || null,
      designation: payload.basicInfo.designation || null,
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
          }))
          .filter((screen) => screen.actionIds.length > 0),
      }))
      .filter((module) => module.userScreens.length > 0),
    dashboardPermissions: payload.dashboardPermissions,
    dataScope: {
      locationNodes: payload.dataScope.locationNodes ?? [],
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

export type LocalBodyScope = {
  localBodyType: string;
  localBodyId: string;
  stateId?: string | null;
  districtId?: string | null;
  areaTypeId?: string | null;
};

type RawLocalBodyScreen = {
  userscreen_id?: string;
  actions?: string[];
};

type RawLocalBodyMainscreen = {
  mainscreen_id?: string;
  mainscreen_name?: string;
  screens?: RawLocalBodyScreen[];
};

type RawAllScreensByLocalBodyResponse = {
  mainscreens?: RawLocalBodyMainscreen[];
};

export type AllowedActionsMap = Record<string, Record<string, boolean>>;

export type EnabledScreensResult = {
  /** Screens/actions Super Admin enabled — the ceiling a staff admin can't exceed. */
  modules: ModulePermission[];
  /** userScreenId -> action -> true, mirrors `modules` for O(1) cap-checks in the UI. */
  allowedActions: AllowedActionsMap;
};

/**
 * Loads ONLY the screens/actions the Super Admin has enabled for this Local
 * Body — screens with no enabled permission rows are simply absent from the
 * response, so hidden screens never appear here (no client-side filtering
 * needed against a fuller catalog). The returned `modules` doubles as the
 * default selection AND the upper bound; a staff admin may only narrow it.
 */
export async function fetchEnabledScreensForLocalBody(
  scope: LocalBodyScope,
  userScreenActions: RawUserScreenAction[],
): Promise<EnabledScreensResult> {
  if (!scope.localBodyType || !scope.localBodyId) return { modules: [], allowedActions: {} };

  const actionLookup = createActionLookup(userScreenActions);
  const [enabledRes, userScreenRes] = await Promise.all([
    api.get("/screen-managements/userscreenpermissions/all-screens-by-staff/", {
      params: {
        local_body_type: scope.localBodyType,
        local_body_id: scope.localBodyId,
        state_id: scope.stateId || undefined,
        district_id: scope.districtId || undefined,
        area_type_id: scope.areaTypeId || undefined,
      },
    }),
    api.get("/screen-managements/userscreens/", { params: { limit: 6000, offset: 0 } }),
  ]);
  const response = enabledRes.data as RawAllScreensByLocalBodyResponse;
  const userScreenNameById = new Map(
    getPayload<RawUserScreen>(userScreenRes.data).map((screen) => [
      toId(screen.unique_id ?? screen.id),
      String(screen.userscreen_name ?? screen.userScreenName ?? ""),
    ]),
  );

  const allowedActions: AllowedActionsMap = {};

  const modules = (response.mainscreens ?? [])
    .map((mainscreen) => {
      const mainScreenId = String(mainscreen.mainscreen_id ?? "");
      if (!mainScreenId) return null;
      const module: ModulePermission = {
        mainScreenId,
        mainScreenName: String(mainscreen.mainscreen_name ?? "Untitled module"),
        enabled: true,
        screens: (mainscreen.screens ?? [])
          .map((screen) => {
            const userScreenId = String(screen.userscreen_id ?? "");
            if (!userScreenId) return null;
            const actions = emptyActions();
            (screen.actions ?? []).forEach((actionId) => {
              const key = normalizeActionKey(actionId, actionLookup);
              if (key) actions[key] = true;
            });
            allowedActions[userScreenId] = { ...actions };
            return {
              userScreenId,
              userScreenName: userScreenNameById.get(userScreenId) || userScreenId,
              enabled: true,
              actions,
            };
          })
          .filter((screen): screen is NonNullable<typeof screen> => screen !== null),
      };
      return module;
    })
    .filter((module): module is ModulePermission => module !== null && module.screens.length > 0);

  return { modules, allowedActions };
}

/**
 * Loads the complete screen/action catalog for non-local-body boundaries
 * such as State or District. There is no local-body Super Admin ceiling for
 * these scopes, so the UI starts every action unchecked and lets the admin
 * explicitly grant permissions.
 */
export async function fetchScreenCatalogPermissions(
  userScreenActions: RawUserScreenAction[],
): Promise<EnabledScreensResult> {
  const [mainScreenRes, userScreenRes] = await Promise.all([
    api.get("/screen-managements/mainscreens/", { params: { limit: 6000, offset: 0 } }),
    api.get("/screen-managements/userscreens/", { params: { limit: 6000, offset: 0 } }),
  ]);

  const actionLookup = createActionLookup(userScreenActions);
  const actionKeys = userScreenActions
    .map((action) => normalizeActionKey(action.unique_id ?? action.id ?? getActionLabel(action), actionLookup))
    .filter(Boolean);
  const uniqueActionKeys = actionKeys.length ? Array.from(new Set(actionKeys)) : DEFAULT_ACTION_NAMES;

  const screensByMainScreenId = new Map<string, RawUserScreen[]>();
  const allUserScreens = getPayload<RawUserScreen>(userScreenRes.data).filter((screen) => !screen.is_deleted);
  allUserScreens.forEach((screen) => {
    const mainScreenId = toId(screen.mainscreen_id ?? screen.mainscreen);
    if (!mainScreenId) return;
    const screens = screensByMainScreenId.get(mainScreenId) ?? [];
    screens.push(screen);
    screensByMainScreenId.set(mainScreenId, screens);
  });

  const mainScreens = getPayload<RawMainScreen>(mainScreenRes.data)
    .filter((mainScreen) => !mainScreen.is_deleted);
  const mainScreenByName = new Map<string, RawMainScreen>();
  mainScreens.forEach((mainScreen) => {
    const name = String(mainScreen.mainscreen_name ?? mainScreen.mainScreenName ?? "");
    catalogAliases(name).forEach((alias) => mainScreenByName.set(alias, mainScreen));
  });

  const screenByMainAndName = new Map<string, RawUserScreen>();
  allUserScreens.forEach((screen) => {
    const mainScreenId = toId(screen.mainscreen_id ?? screen.mainscreen);
    const screenName = String(screen.userscreen_name ?? screen.userScreenName ?? "");
    catalogAliases(screenName).forEach((alias) => {
      screenByMainAndName.set(`${mainScreenId}|${alias}`, screen);
    });
  });

  const allowedActions: AllowedActionsMap = {};
  const modules: ModulePermission[] = [];

  APP_SIDEBAR_PERMISSION_CATALOG.forEach((catalogModule) => {
    const mainScreen = [...catalogAliases(catalogModule.module)]
      .map((alias) => mainScreenByName.get(alias))
      .find(Boolean);
    const mainScreenId = toId(mainScreen?.unique_id ?? mainScreen?.id);
    if (!mainScreenId) return;

    const screens = catalogModule.screens
      .map((screenName) => {
        const screen = [...catalogAliases(screenName)]
          .map((alias) => screenByMainAndName.get(`${mainScreenId}|${alias}`))
          .find(Boolean);
        const userScreenId = toId(screen?.unique_id ?? screen?.id);
        if (!userScreenId) return null;
        const actions = Object.fromEntries(uniqueActionKeys.map((action) => [action, false]));
        allowedActions[userScreenId] = Object.fromEntries(uniqueActionKeys.map((action) => [action, true]));
        return {
          userScreenId,
          userScreenName: screenName,
          enabled: true,
          actions,
        };
      })
      .filter((screen): screen is NonNullable<typeof screen> => screen !== null);

    if (!screens.length) return;
    modules.push({
      mainScreenId,
      mainScreenName: catalogModule.module,
      enabled: true,
      screens,
    });
  });

  if (modules.length) return { modules, allowedActions };

  mainScreens
    .sort((a, b) => Number(a.order_no ?? 0) - Number(b.order_no ?? 0))
    .forEach((mainScreen) => {
      const mainScreenId = toId(mainScreen.unique_id ?? mainScreen.id);
      if (!mainScreenId) return;
      const screens = (screensByMainScreenId.get(mainScreenId) ?? [])
        .sort((a, b) => Number(a.order_no ?? 0) - Number(b.order_no ?? 0))
        .map((screen) => {
          const userScreenId = toId(screen.unique_id ?? screen.id);
          if (!userScreenId) return null;
          const actions = Object.fromEntries(uniqueActionKeys.map((action) => [action, false]));
          allowedActions[userScreenId] = Object.fromEntries(uniqueActionKeys.map((action) => [action, true]));
          return {
            userScreenId,
            userScreenName: String(screen.userscreen_name ?? screen.userScreenName ?? userScreenId),
            enabled: true,
            actions,
          };
        })
        .filter((screen): screen is NonNullable<typeof screen> => screen !== null);
      if (!screens.length) return;
      modules.push({
        mainScreenId,
        mainScreenName: String(mainScreen.mainscreen_name ?? mainScreen.mainScreenName ?? "Untitled module"),
        enabled: true,
        screens,
      });
    });

  return { modules, allowedActions };
}

/**
 * Overlays a staff member's previously-saved permissions onto the CURRENT
 * Super-Admin-enabled ceiling (`enabledModules`, from
 * `fetchEnabledScreensForLocalBody`) — the base is always the full current
 * ceiling, not the staff's old saved set, so a module/screen Super Admin has
 * enabled SINCE the staff was last saved still appears (just unchecked,
 * since the staff was never explicitly granted it). An action ends up
 * checked only if it was both previously saved AND is still currently
 * allowed, so a screen/action Super Admin has since disabled is correctly
 * dropped.
 */
export function applyAllowedActionsCeiling(
  enabledModules: ModulePermission[],
  savedModules: ModulePermission[],
): ModulePermission[] {
  const savedByScreenId = new Map<string, ModulePermission["screens"][number]>();
  savedModules.forEach((module) => {
    module.screens.forEach((screen) => {
      savedByScreenId.set(screen.userScreenId, screen);
    });
  });

  return enabledModules.map((module) => ({
    ...module,
    screens: module.screens.map((screen) => {
      const saved = savedByScreenId.get(screen.userScreenId);
      const actions = { ...emptyActions() };
      Object.keys(actions).forEach((action) => {
        actions[action] = Boolean(saved?.actions[action]) && Boolean(screen.actions[action]);
      });
      return { ...screen, actions };
    }),
  }));
}

type RawDashboardWidgetPermission = {
  widget_name?: string;
  widgetName?: string;
  is_enabled?: boolean;
  isEnabled?: boolean;
  order_no?: number;
  orderNo?: number;
};

/**
 * Loads ONLY the dashboard widgets Super Admin has actually enabled for this
 * Local Body. Returns an empty array if none are configured — callers must
 * not fall back to a hardcoded default set, since that would silently grant
 * widgets nobody enabled.
 *
 * Defaults to the Super Admin baseline (permission_owner_kind="super_admin")
 * — the ceiling a staff admin can't exceed. Staff Access Configuration must
 * use this default so a staff member's own widget rows (same table, tagged
 * permission_owner_kind="staff") don't get mixed in as extra, un-toggleable
 * entries.
 */
export async function fetchDashboardWidgetsForLocalBody(
  scope: LocalBodyScope,
  permissionOwnerKind: "super_admin" | "staff" = "super_admin",
): Promise<DashboardWidget[]> {
  if (!scope.localBodyType || !scope.localBodyId) return [];

  const { data } = await api.get("/screen-managements/dashboard-widget-permissions/", {
    params: {
      local_body_type: scope.localBodyType,
      local_body_id: scope.localBodyId,
      permission_owner_kind: permissionOwnerKind,
      limit: 6000,
      offset: 0,
    },
  });

  return getPayload<RawDashboardWidgetPermission>(data)
    .map((widget) => ({
      widgetName: String(widget.widget_name ?? widget.widgetName ?? ""),
      isEnabled: Boolean(widget.is_enabled ?? widget.isEnabled ?? false),
      orderNo: Number(widget.order_no ?? widget.orderNo ?? 0),
    }))
    .filter((widget) => widget.widgetName)
    .sort((a, b) => a.orderNo - b.orderNo);
}

async function fetchRawUserScreenActionRecords(): Promise<RawUserScreenAction[]> {
  const { data } = await api.get("/screen-managements/userscreen-action/", {
    params: { limit: 6000, offset: 0 },
  });
  return getPayload<RawUserScreenAction>(data).filter((action) => !action.is_deleted);
}

/**
 * UI-facing action options for the permission tree's column headers/keys.
 * `value` is the canonical literal action name (e.g. "view"), NOT the raw
 * unique_id — `screen.actions`/`allowedActions` throughout this feature
 * (mapPermissionModules, applyAllowedActionsCeiling, emptyActions) are all
 * keyed by that canonical name, so PermissionTree's
 * `allowedForScreen[action.value]`/`screen.actions[action.value]` lookups
 * only resolve when this matches. For resolving a saved/ceiling action's raw
 * unique_id back to this canonical name, use `fetchRawUserScreenActions()` +
 * `createActionLookup` instead — that needs the real unique_id, which this
 * function deliberately does not expose.
 */
export async function fetchUserScreenActions() {
  const raw = await fetchRawUserScreenActionRecords();
  const seen = new Set<string>();
  const actions = raw
    .map((action) => ({
      value: normalizeActionName(getActionLabel(action)),
      label: getActionLabel(action),
    }))
    .filter((action) => {
      if (!action.value || !action.label || seen.has(action.value)) return false;
      seen.add(action.value);
      return true;
    });

  return actions.length
    ? actions
    : DEFAULT_ACTION_NAMES.map((action) => ({ value: action, label: action }));
}

/**
 * Raw `{unique_id, action_name}` action records — feed these into
 * `createActionLookup`/`fetchEnabledScreensForLocalBody` to resolve a saved
 * permission's or the Super-Admin ceiling's raw action unique_ids back to
 * their canonical literal names. Use `fetchUserScreenActions()` instead for
 * the permission tree's own UI options.
 */
export async function fetchRawUserScreenActions(): Promise<RawUserScreenAction[]> {
  return fetchRawUserScreenActionRecords();
}
