import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, KeyRound, Loader2, MapPinned, ShieldCheck, UserRound } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select, { type SelectOption } from "@/components/form/Select";
import PasswordInput from "@/components/form/input/PasswordInput";
import { Input } from "@/components/ui/input";
import Swal from "@/lib/notify";
import { adminApi } from "@/helpers/admin/registry";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";

import DashboardWidgetPanel from "./DashboardWidgetPanel";
import PermissionTree from "./PermissionTree";
import {
  applyAllowedActionsCeiling,
  createActionLookup,
  createStaffAccess,
  fetchStaffAccess,
  fetchDashboardWidgetsForLocalBody,
  fetchEnabledScreensForLocalBody,
  fetchRawUserScreenActions,
  fetchScreenCatalogPermissions,
  fetchUserScreenActions,
  mapPermissionModules,
  updateStaffAccess,
  type AllowedActionsMap,
} from "@/helpers/admin/staffAccessConfigApi";
import type {
  AreaTypeCategory,
  DashboardWidget,
  LocalBodyLevel,
  ModulePermission,
  StaffAccessConfigPayload,
  UserActionOption,
} from "./types";
import {
  mergeWithScopeOptionExtra,
  scopeOption,
} from "../../../masters/shared/dataScopeOptions";
import type { ScopeLevel } from "../../../masters/shared/dataScopeOptions";

type FormValues = {
  employeeName: string;
  staffConfigName: string;
  mobileNumber: string;
  officeEmail: string;
  departmentId: string;
  designation: string;
  doj: string;
  activeStatus: boolean;
  username: string;
  password: string;
  confirmPassword: string;
  userTypeId: string;
  governmentUserTypeId: string;
  loginEnabled: boolean;
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyLevel: LocalBodyLevel | "";
  localBodyId: string;
  locationNodeIds: string[];
};

type ApiOptionRecord = {
  unique_id?: string;
  id?: string;
  name?: string;
  employee_name?: string;
  department_name?: string;
  designation_name?: string;
  vehicle_no?: string;
  registration_number?: string;
  usertype_id?: string | { unique_id?: string };
  user_type_id?: string;
  state_id?: string | { unique_id?: string };
  state_name?: string;
  district_id?: string | { unique_id?: string };
  district_name?: string;
  area_type_id?: string | { unique_id?: string };
  area_type_name?: string;
  corporation_name?: string;
  municipality_name?: string;
  town_panchayat_name?: string;
  panchayat_union_name?: string;
  union_name?: string;
  panchayat_name?: string;
  name_display?: string;
  level?: string;
  level_display?: string;
};

const TABS = ["Basic Info", "Login", "Data Scope", "Permissions", "Review"] as const;
const STEP_ROUTE_SEGMENTS = ["basic-info", "login-details", "data-scope", "permissions", "review"] as const;
const DATA_SCOPE_TAB = 2;
const PERMISSIONS_TAB = 3;
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md border !border-[#22a855] !bg-[#22a855] px-5 py-2 text-sm font-semibold !text-white shadow-sm transition hover:!bg-[#1a8a44] disabled:opacity-60";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md border !border-[#22a855] !bg-white px-4 py-2 text-sm font-semibold !text-[#22a855] transition hover:!bg-[#e8f8ee] dark:!bg-transparent dark:hover:!bg-[#22a855]/10";
const CANCEL_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md border !border-[#f7192b] !bg-[#f7192b] px-4 py-2 text-sm font-semibold !text-white transition hover:!bg-[#d91626]";

// Main screen (module) name of the schedule / daily-trip module a Corporation
// Supervisor may write to. Matches the backend `mainscreen_name`.
const SCHEDULE_MODULE_NAME = "schedule-masters";

/** True when the chosen government role is a supervisor (e.g.
 * `govt_corporation_supervisor`) or the company supervisor role. */
const isSupervisorRoleName = (name?: string): boolean => {
  const n = (name ?? "").toLowerCase();
  return n.endsWith("_supervisor") || n === "supervisor" || n === "company_supervisor";
};

const normalizeRoleLevel = (level?: string): string =>
  String(level ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

const normalizeRoleText = (value?: string): string =>
  String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

const isLocalBodyRole = (role?: ApiOptionRecord): boolean => {
  const text = normalizeRoleText(
    [
      role?.name,
      role?.name_display,
      role?.level,
      role?.level_display,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return [
    "corporation",
    "municipality",
    "town_panchayat",
    "panchayat_union",
    "panchayat",
    "local_body",
    "ulb",
    "rlb",
  ].some((keyword) => text.includes(keyword));
};

/**
 * Default permission selection for a newly-created supervisor: full CRUD on the
 * schedule / daily-trip module, view-only everywhere else. Keeps the caller
 * within the Super-Admin ceiling (the tree only renders actions Super Admin
 * allowed), so this only pre-checks; it never grants beyond the ceiling.
 */
const applySupervisorScheduleDefaults = (
  modules: ModulePermission[],
): ModulePermission[] =>
  modules.map((module) => {
    const isSchedule = module.mainScreenName === SCHEDULE_MODULE_NAME;
    return {
      ...module,
      screens: module.screens.map((screen) => ({
        ...screen,
        actions: Object.fromEntries(
          Object.keys(screen.actions).map((action) => [
            action,
            isSchedule ? true : action === "view",
          ]),
        ),
      })),
    };
  });

const applySavedActionsToCatalog = (
  catalogModules: ModulePermission[],
  savedModules: ModulePermission[],
): ModulePermission[] => {
  const savedByScreenId = new Map<string, ModulePermission["screens"][number]>();
  savedModules.forEach((module) => {
    module.screens.forEach((screen) => {
      savedByScreenId.set(screen.userScreenId, screen);
    });
  });

  return catalogModules.map((module) => ({
    ...module,
    screens: module.screens.map((screen) => {
      const saved = savedByScreenId.get(screen.userScreenId);
      return {
        ...screen,
        actions: Object.fromEntries(
          Object.keys(screen.actions).map((action) => [
            action,
            Boolean(saved?.actions[action]),
          ]),
        ),
      };
    }),
  }));
};

const LOCAL_BODY_LEVELS: Array<{ value: LocalBodyLevel; label: string; entity: keyof typeof adminApi }> = [
  { value: "corporation_id", label: "Corporation", entity: "corporations" },
  { value: "municipality_id", label: "Municipality", entity: "municipalities" },
  { value: "town_panchayat_id", label: "Town Panchayat", entity: "townPanchayats" },
  { value: "panchayat_union_id", label: "Panchayat Union", entity: "panchayatUnions" },
  { value: "panchayat_id", label: "Panchayat", entity: "panchayats" },
];

const AREA_TYPE_LEVELS: Record<AreaTypeCategory, LocalBodyLevel[]> = {
  urban: ["corporation_id", "municipality_id", "town_panchayat_id"],
  rural: ["panchayat_union_id", "panchayat_id"],
};

const areaTypeCategoryFromName = (name: string): AreaTypeCategory | null => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return null;
};

const normalizeEntityId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "unique_id" in (value as Record<string, unknown>)) {
    return String((value as { unique_id?: string }).unique_id ?? "");
  }
  return String(value);
};

const defaultValues: FormValues = {
  employeeName: "",
  staffConfigName: "",
  mobileNumber: "",
  officeEmail: "",
  departmentId: "",
  designation: "",
  doj: "",
  activeStatus: true,
  username: "",
  password: "",
  confirmPassword: "",
  userTypeId: "",
  governmentUserTypeId: "",
  loginEnabled: true,
  stateId: "",
  districtId: "",
  areaTypeId: "",
  localBodyLevel: "",
  localBodyId: "",
  locationNodeIds: [],
};

const optionLabel = (record: ApiOptionRecord) =>
  record.employee_name ??
  record.department_name ??
  record.designation_name ??
  record.corporation_name ??
  record.municipality_name ??
  record.town_panchayat_name ??
  record.panchayat_union_name ??
  record.union_name ??
  record.panchayat_name ??
  record.area_type_name ??
  record.district_name ??
  record.state_name ??
  record.vehicle_no ??
  record.registration_number ??
  record.name ??
  record.unique_id ??
  record.id ??
  "";

const toOptions = (records: ApiOptionRecord[]): SelectOption[] =>
  records
    .map((record) => ({
      value: String(record.unique_id ?? record.id ?? ""),
      label: optionLabel(record),
    }))
    .filter((option) => option.value);

const labelFromOptions = (options: SelectOption[], value: string | null | undefined) => {
  const label = options.find((option) => option.value === value)?.label;
  return typeof label === "string" ? label : label ? String(label) : "";
};

const extractErrorMap = (error: unknown) => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return {};
  const output: Record<string, string> = {};
  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    if (Array.isArray(value)) output[key] = String(value[0] ?? "");
    else if (typeof value === "string") output[key] = value;
    else if (value && typeof value === "object") output[key] = JSON.stringify(value);
  });
  return output;
};

const firstApiError = (errorMap: Record<string, string>, fallback: string) =>
  errorMap.non_field_errors ||
  errorMap.detail ||
  Object.values(errorMap).find(Boolean) ||
  fallback;

export default function StaffAccessConfigPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encUserManagement, encStaffAccessConfiguration } = getEncryptedRoute();
  const { listPath, newPath, editPath } = createCrudRoutePaths(encUserManagement, encStaffAccessConfiguration);

  const {
    register,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues, mode: "onBlur" });

  const values = watch();
  const [activeTab, setActiveTab] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [modules, setModules] = useState<ModulePermission[]>([]);
  const [allowedActions, setAllowedActions] = useState<AllowedActionsMap>({});
  const [actionOptions, setActionOptions] = useState<UserActionOption[]>([]);
  const [savedPermissionModules, setSavedPermissionModules] = useState<ModulePermission[] | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [savedWidgets, setSavedWidgets] = useState<DashboardWidget[] | null>(null);
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedConfigId, setLoadedConfigId] = useState<string | null>(null);
  const [loadedPermissionScopeKey, setLoadedPermissionScopeKey] = useState("");

  const [userTypes, setUserTypes] = useState<ApiOptionRecord[]>([]);
  const [governmentRoles, setGovernmentRoles] = useState<ApiOptionRecord[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([]);

  const [governmentLevel, setGovernmentLevel] = useState("");

  const [stateOptions, setStateOptions] = useState<SelectOption[]>([]);
  const [districtRecords, setDistrictRecords] = useState<ApiOptionRecord[]>([]);
  const [areaTypeRecords, setAreaTypeRecords] = useState<ApiOptionRecord[]>([]);
  const [localBodyRecords, setLocalBodyRecords] = useState<Record<LocalBodyLevel, ApiOptionRecord[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });

  useEffect(() => {
    let mounted = true;

    // The State/District/Area Type/local-body screens may not be
    // permission-granted to the ACTING admin at all (View gates each
    // level's own menu/list, not these dropdowns) — their Data Scope from
    // login always supplies their own hierarchy values regardless. This
    // only ever ADDS the acting admin's own scope as an extra option,
    // never removes/restricts the staff-configuration options otherwise
    // available here.
    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    const scopeRecord = (
      level: ScopeLevel,
      extra: Partial<ApiOptionRecord> = {},
    ): ApiOptionRecord | null => {
      const scoped = scopeOption(level);
      if (!scoped) return null;
      return { unique_id: scoped.value, name: scoped.label, ...extra };
    };

    const mergeRecord = (
      records: ApiOptionRecord[],
      level: ScopeLevel,
      extra: Partial<ApiOptionRecord> = {},
    ): ApiOptionRecord[] => {
      const record = scopeRecord(level, extra);
      if (!record) return records;
      if (records.some((item) => (item.unique_id ?? item.id) === record.unique_id)) return records;
      return [record, ...records];
    };

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [
          userTypeRes,
          governmentRoleRes,
          stateRes,
          districtRes,
          areaTypeRes,
          corporationRes,
          municipalityRes,
          townPanchayatRes,
          panchayatUnionRes,
          panchayatRes,
        ] = await Promise.allSettled([
          adminApi.userTypes.readAll(),
          adminApi.governmentUserTypes.readAll(),
          adminApi.states.readAll(),
          adminApi.districts.readAll(),
          adminApi.areatypes.readAll(),
          adminApi.corporations.readAll(),
          adminApi.municipalities.readAll(),
          adminApi.townPanchayats.readAll(),
          adminApi.panchayatUnions.readAll(),
          adminApi.panchayats.readAll(),
        ]);
        if (!mounted) return;
        const valueOrEmpty = (result: PromiseSettledResult<unknown>) =>
          result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [];

        setUserTypes(valueOrEmpty(userTypeRes) as ApiOptionRecord[]);
        setGovernmentRoles(valueOrEmpty(governmentRoleRes) as ApiOptionRecord[]);
        // Departments are loaded separately, filtered by the selected
        // corporation (see the corporation-scoped effect below).
        setStateOptions(
          mergeWithScopeOptionExtra(
            toOptions(valueOrEmpty(stateRes) as ApiOptionRecord[]) as Array<{ value: string; label: string }>,
            "state",
            {},
          ) as SelectOption[],
        );
        setDistrictRecords(
          mergeRecord(
            valueOrEmpty(districtRes) as ApiOptionRecord[],
            "district",
            scopedStateId ? { state_id: scopedStateId } : {},
          ),
        );
        setAreaTypeRecords(
          mergeRecord(
            valueOrEmpty(areaTypeRes) as ApiOptionRecord[],
            "area_type",
            scopedDistrictId ? { district_id: scopedDistrictId } : {},
          ),
        );
        setLocalBodyRecords({
          corporation_id: mergeRecord(
            valueOrEmpty(corporationRes) as ApiOptionRecord[],
            "corporation",
            scopedDistrictId ? { district_id: scopedDistrictId } : {},
          ),
          municipality_id: mergeRecord(
            valueOrEmpty(municipalityRes) as ApiOptionRecord[],
            "municipality",
            scopedDistrictId ? { district_id: scopedDistrictId } : {},
          ),
          town_panchayat_id: mergeRecord(
            valueOrEmpty(townPanchayatRes) as ApiOptionRecord[],
            "town_panchayat",
            scopedDistrictId ? { district_id: scopedDistrictId } : {},
          ),
          panchayat_union_id: mergeRecord(
            valueOrEmpty(panchayatUnionRes) as ApiOptionRecord[],
            "panchayat_union",
            scopedDistrictId ? { district_id: scopedDistrictId } : {},
          ),
          panchayat_id: mergeRecord(
            valueOrEmpty(panchayatRes) as ApiOptionRecord[],
            "panchayat",
            scopedDistrictId ? { district_id: scopedDistrictId } : {},
          ),
        });
      } catch {
        if (mounted) {
          setStateOptions(
            (prev) =>
              mergeWithScopeOptionExtra(
                prev as Array<{ value: string; label: string }>,
                "state",
                {},
              ) as SelectOption[],
          );
          setDistrictRecords((prev) =>
            mergeRecord(prev, "district", scopedStateId ? { state_id: scopedStateId } : {}),
          );
          setAreaTypeRecords((prev) =>
            mergeRecord(prev, "area_type", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          );
          setLocalBodyRecords((prev) => ({
            corporation_id: mergeRecord(prev.corporation_id, "corporation", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
            municipality_id: mergeRecord(prev.municipality_id, "municipality", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
            town_panchayat_id: mergeRecord(prev.town_panchayat_id, "town_panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
            panchayat_union_id: mergeRecord(prev.panchayat_union_id, "panchayat_union", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
            panchayat_id: mergeRecord(prev.panchayat_id, "panchayat", scopedDistrictId ? { district_id: scopedDistrictId } : {}),
          }));
          Swal.fire("Error", "Failed to load staff access options.", "error");
        }
      } finally {
        if (mounted) setLoadingOptions(false);
      }
    };
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  // Departments belong to a corporation. Load them filtered by the corporation
  // chosen in the data scope (when the selected local body is a corporation);
  // otherwise load all so the field stays usable before the scope step.
  const selectedCorporationId =
    values.localBodyLevel === "corporation_id" ? values.localBodyId : "";
  useEffect(() => {
    let active = true;
    const request = selectedCorporationId
      ? adminApi.departments.readAll({ params: { corporation_id: selectedCorporationId } })
      : adminApi.departments.readAll();
    request
      .then((res) => {
        if (active) {
          setDepartmentOptions(toOptions((Array.isArray(res) ? res : []) as ApiOptionRecord[]));
        }
      })
      .catch(() => {
        if (active) setDepartmentOptions([]);
      });
    return () => {
      active = false;
    };
  }, [selectedCorporationId]);

  useEffect(() => {
    if (!isEdit || !id || loadingOptions || loadedConfigId === id) return;
    let cancelled = false;

    const loadExistingConfig = async () => {
      setLoadingPermissions(true);
      try {
        const record = await fetchStaffAccess(id);
        if (cancelled) return;

        const basicInfo = record.basicInfo ?? {};
        const loginConfig = record.loginConfig ?? {};
        const dataScope = record.dataScope ?? {};
        const roleId = String(
          loginConfig.governmentUserTypeId ??
            record.governmentusertype_id ??
            "",
        );
        const role = governmentRoles.find((item) => normalizeEntityId(item.unique_id ?? item.id) === roleId);
        const roleLevel = String(role?.level ?? record.governmentusertype_level ?? "");
        const localBodyLevel = String(dataScope.localBodyLevel ?? "") as FormValues["localBodyLevel"];
        const localBodyId = String(
          dataScope.localBodyId ??
            dataScope.corporationId ??
            dataScope.municipalityId ??
            dataScope.townPanchayatId ??
            dataScope.panchayatUnionId ??
            dataScope.panchayatId ??
            "",
        );

        setValue("employeeName", String(basicInfo.employeeName ?? record.employee_name ?? ""));
        setValue("staffConfigName", String(basicInfo.staffConfigName ?? record.staff_config_name ?? ""));
        setValue("mobileNumber", String(basicInfo.mobileNumber ?? record.contact_mobile ?? ""));
        setValue("officeEmail", String(basicInfo.officeEmail ?? record.contact_email ?? ""));
        setValue("departmentId", String(basicInfo.departmentId ?? record.department_id ?? ""));
        setValue("designation", String(basicInfo.designation ?? record.designation ?? ""));
        setValue("doj", String(basicInfo.doj ?? record.doj ?? ""));
        setValue("activeStatus", Boolean(basicInfo.activeStatus ?? record.active_status ?? true));
        setValue("username", String(loginConfig.username ?? record.username ?? ""));
        const existingPassword = String(loginConfig.password ?? record.password ?? "");
        setValue("password", existingPassword);
        setValue("confirmPassword", String(loginConfig.confirmPassword ?? existingPassword));
        setValue("userTypeId", String(loginConfig.userTypeId ?? record.user_type_id ?? ""));
        setValue("governmentUserTypeId", roleId);
        setValue(
          "loginEnabled",
          Boolean(loginConfig.loginEnabled ?? record.login_enabled ?? true),
        );
        setGovernmentLevel(roleLevel);
        setValue("stateId", String(dataScope.stateId ?? ""));
        setValue("districtId", String(dataScope.districtId ?? ""));
        setValue("areaTypeId", String(dataScope.areaTypeId ?? ""));
        setValue("localBodyLevel", localBodyLevel || "");
        setValue("localBodyId", localBodyId);
        setValue(
          "locationNodeIds",
          Array.isArray(dataScope.locationNodes)
            ? dataScope.locationNodes.map((nodeId) => String(nodeId))
            : [],
        );

        const [nextActions, rawActions] = await Promise.all([
          fetchUserScreenActions(),
          fetchRawUserScreenActions(),
        ]);
        if (cancelled) return;
        setActionOptions(nextActions);

        if (Array.isArray(record.permissions) && record.permissions.length) {
          const actionLookup = createActionLookup(rawActions);
          setSavedPermissionModules(mapPermissionModules(record.permissions, actionLookup));
        }

        if (Array.isArray(record.dashboardPermissions) && record.dashboardPermissions.length) {
          setSavedWidgets(record.dashboardPermissions);
        }
        setLoadedConfigId(id);
      } catch (error) {
        if (!cancelled) {
          const errorMap = extractErrorMap(error);
          Swal.fire("Error", firstApiError(errorMap, "Failed to load staff access configuration."), "error");
        }
      } finally {
        if (!cancelled) setLoadingPermissions(false);
      }
    };

    void loadExistingConfig();
    return () => {
      cancelled = true;
    };
  }, [governmentRoles, id, isEdit, loadedConfigId, loadingOptions, setValue]);

  const userTypeOptions = useMemo(() => toOptions(userTypes), [userTypes]);

  const formBasePath = useMemo(
    () => (isEdit && id ? editPath(id) : newPath),
    [editPath, id, isEdit, newPath],
  );

  const stepPaths = useMemo(
    () =>
      STEP_ROUTE_SEGMENTS.map((_, index) =>
        `${formBasePath}/${STEP_ROUTE_SEGMENTS.slice(0, index + 1).join("/")}`,
      ),
    [formBasePath],
  );

  const stepPathFor = useCallback(
    (index: number) => stepPaths[index] ?? stepPaths[0] ?? formBasePath,
    [formBasePath, stepPaths],
  );
  const firstStepPath = stepPaths[0] ?? formBasePath;

  useEffect(() => {
    const matchedIndex = STEP_ROUTE_SEGMENTS.reduce((latestMatch, segment, index) => {
      return location.pathname.includes(`/${segment}`) ? index : latestMatch;
    }, -1);
    if (matchedIndex < 0 && location.pathname.replace(/\/+$/, "") === formBasePath) {
      navigate(firstStepPath, { replace: true });
      return;
    }
    const nextTabIndex = matchedIndex >= 0 ? matchedIndex : 0;
    setActiveTab((current) => (current === nextTabIndex ? current : nextTabIndex));
  }, [firstStepPath, formBasePath, location.pathname, navigate]);

  const governmentLevelOptions = useMemo(() => {
    const seen = new Set<string>();
    return governmentRoles
      .filter((role) => {
        const level = role.level ?? "";
        if (!level || seen.has(level)) return false;
        seen.add(level);
        return true;
      })
      .map((role) => ({ value: role.level ?? "", label: role.level_display || role.level || "" }));
  }, [governmentRoles]);

  const governmentRoleOptions = useMemo(() => {
    if (!governmentLevel) return [];
    return toOptions(
      governmentRoles
        .filter((role) => role.level === governmentLevel)
        .map((role) => ({ ...role, name: role.name_display || role.name })),
    );
  }, [governmentLevel, governmentRoles]);

  const hasLocalBody = Boolean(values.localBodyLevel && values.localBodyId);
  const selectedGovernmentRole = useMemo(
    () =>
      governmentRoles.find(
        (role) => normalizeEntityId(role.unique_id ?? role.id) === values.governmentUserTypeId,
      ),
    [governmentRoles, values.governmentUserTypeId],
  );
  const isLocalBodyRoleSelected = isLocalBodyRole(selectedGovernmentRole);
  const selectedGovernmentLevel = normalizeRoleLevel(governmentLevel);
  const isStateScopeSelected = selectedGovernmentLevel === "state";
  const isDistrictScopeSelected = selectedGovernmentLevel === "district" && !isLocalBodyRoleSelected;
  const isLocalBodyScopeRequired =
    isLocalBodyRoleSelected ||
    (Boolean(selectedGovernmentLevel) && !isStateScopeSelected && !isDistrictScopeSelected);
  const isLocalBodyScopeStarted = Boolean(values.areaTypeId || values.localBodyLevel || values.localBodyId);
  const shouldShowLocalBodyScope = isLocalBodyScopeRequired || isDistrictScopeSelected;
  const dataScopeBoundaryLabel = isStateScopeSelected
    ? "State"
    : isDistrictScopeSelected && !hasLocalBody
      ? "District"
      : "Local Body";
  const hasNonLocalBodyBoundary =
    (isStateScopeSelected && Boolean(values.stateId)) ||
    (isDistrictScopeSelected && Boolean(values.districtId));
  const canLoadPermissions = hasLocalBody || hasNonLocalBodyBoundary;
  const permissionScopeKey = hasLocalBody
    ? [
        "local-body",
        values.stateId,
        values.districtId,
        values.areaTypeId,
        values.localBodyLevel,
        values.localBodyId,
      ].join("|")
    : hasNonLocalBodyBoundary
      ? [
          dataScopeBoundaryLabel.toLowerCase(),
          values.stateId,
          values.districtId,
        ].join("|")
      : "";

  const isSupervisorRoleSelected = useMemo(() => {
    return isSupervisorRoleName(selectedGovernmentRole?.name);
  }, [selectedGovernmentRole]);

  useEffect(() => {
    if (!isStateScopeSelected) return;
    if (!values.areaTypeId && !values.localBodyLevel && !values.localBodyId) return;
    setValue("areaTypeId", "");
    setValue("localBodyLevel", "");
    setValue("localBodyId", "");
    setValue("locationNodeIds", []);
  }, [
    isStateScopeSelected,
    setValue,
    values.areaTypeId,
    values.localBodyId,
    values.localBodyLevel,
  ]);

  useEffect(() => {
    if (activeTab !== PERMISSIONS_TAB || !canLoadPermissions) return;
    if (loadedPermissionScopeKey === permissionScopeKey && modules.length > 0) return;
    let cancelled = false;
    const loadPermissions = async () => {
      setLoadingPermissions(true);
      try {
        const [nextActions, rawActions] = await Promise.all([
          fetchUserScreenActions(),
          fetchRawUserScreenActions(),
        ]);
        const localBodyScope = hasLocalBody
          ? {
              localBodyType: values.localBodyLevel.replace(/_id$/, ""),
              localBodyId: values.localBodyId,
              stateId: values.stateId,
              districtId: values.districtId,
              areaTypeId: values.areaTypeId,
            }
          : null;
        const [{ modules: enabledModules, allowedActions: nextAllowedActions }, enabledWidgets] =
          localBodyScope
            ? await Promise.all([
                fetchEnabledScreensForLocalBody(localBodyScope, rawActions),
                fetchDashboardWidgetsForLocalBody(localBodyScope),
              ])
            : [
                await fetchScreenCatalogPermissions(rawActions),
                [] as DashboardWidget[],
              ];
        if (cancelled) return;

        setActionOptions(nextActions);
        setAllowedActions(nextAllowedActions);

        // Seed from the CURRENT Super Admin ceiling (so a module/screen
        // enabled since the staff was last saved still appears), overlaying
        // the staff's previously-saved selections on top (edit mode) — a
        // screen/action disabled since the staff was last saved must not
        // silently reappear as checked.
        const seeded = savedPermissionModules
          ? localBodyScope
            ? applyAllowedActionsCeiling(enabledModules, savedPermissionModules)
            : applySavedActionsToCatalog(enabledModules, savedPermissionModules)
          : enabledModules;
        let finalModules = seeded.length ? seeded : enabledModules;
        // On first configuration of a supervisor, default the tree to full CRUD
        // on the schedule/daily-trip module and view-only elsewhere (F1). Edit
        // mode keeps the staff's previously-saved selections.
        if (!isEdit && !savedPermissionModules && isSupervisorRoleSelected) {
          finalModules = applySupervisorScheduleDefaults(finalModules);
        }
        setModules(finalModules);

        // Same principle for dashboard widgets — only what Super Admin
        // enabled for this Local Body may appear, and any staff-saved
        // isEnabled value is capped to still-enabled widgets only.
        const savedByName = new Map((savedWidgets ?? []).map((w) => [w.widgetName, w]));
        setWidgets(
          enabledWidgets.map((widget) => ({
            ...widget,
            isEnabled: widget.isEnabled && (savedByName.get(widget.widgetName)?.isEnabled ?? widget.isEnabled),
          })),
        );
        setLoadedPermissionScopeKey(permissionScopeKey);
      } catch {
        if (!cancelled) Swal.fire("Error", "Failed to load permissions.", "error");
      } finally {
        if (!cancelled) setLoadingPermissions(false);
      }
    };
    void loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    canLoadPermissions,
    hasLocalBody,
    hasNonLocalBodyBoundary,
    loadedPermissionScopeKey,
    modules.length,
    permissionScopeKey,
    values.localBodyLevel,
    values.localBodyId,
    values.stateId,
    values.districtId,
    values.areaTypeId,
    savedPermissionModules,
    savedWidgets,
    isEdit,
    isSupervisorRoleSelected,
  ]);

  const districtOptions = useMemo(() => {
    if (!values.stateId) return [];
    return toOptions(
      districtRecords.filter((district) => normalizeEntityId(district.state_id) === values.stateId),
    );
  }, [districtRecords, values.stateId]);

  const areaTypeOptions = useMemo(() => {
    if (!values.districtId) return [];
    return toOptions(
      areaTypeRecords.filter((areaType) => normalizeEntityId(areaType.district_id) === values.districtId),
    );
  }, [areaTypeRecords, values.districtId]);

  const selectedAreaTypeCategory = useMemo((): AreaTypeCategory | null => {
    const record = areaTypeRecords.find((areaType) => areaType.unique_id === values.areaTypeId);
    return record ? areaTypeCategoryFromName(String(record.name ?? "")) : null;
  }, [areaTypeRecords, values.areaTypeId]);

  const availableLocalBodyLevels = useMemo(() => {
    if (!selectedAreaTypeCategory) return [];
    const levels = AREA_TYPE_LEVELS[selectedAreaTypeCategory];
    return LOCAL_BODY_LEVELS.filter((level) => levels.includes(level.value));
  }, [selectedAreaTypeCategory]);

  const localBodyOptions = useMemo(() => {
    if (!values.localBodyLevel || !values.districtId) return [];
    const records = localBodyRecords[values.localBodyLevel as LocalBodyLevel] ?? [];
    return toOptions(
      records.filter((record) => normalizeEntityId(record.district_id) === values.districtId),
    );
  }, [localBodyRecords, values.districtId, values.localBodyLevel]);

  const tabFields = (tab: number) => {
    if (tab === 0) {
      return ["employeeName", "staffConfigName", "mobileNumber", "departmentId"] as const;
    }
    if (tab === 1) {
      return ["username", "password", "confirmPassword", "userTypeId", "governmentUserTypeId"] as const;
    }
    return [] as const;
  };

  /**
   * Validate the fields owned by `tab` before allowing the wizard to advance
   * past it. Returns true when the step is complete; on failure it records a
   * `stepError` banner (and, for the login tab, an inline password error).
   */
  const validateTab = async (tab: number): Promise<boolean> => {
    setStepError(null);
    const valid = await trigger(tabFields(tab));
    if (!valid) {
      setStepError("Please complete the required fields on this tab before continuing.");
      return false;
    }
    if (
      tab === 1 &&
      (getValues("password") || getValues("confirmPassword")) &&
      getValues("password") !== getValues("confirmPassword")
    ) {
      setApiErrors({ confirmPassword: "Passwords do not match." });
      setStepError("Passwords do not match.");
      return false;
    }
    if (tab === DATA_SCOPE_TAB) {
      // The chosen government level decides the enforced access boundary.
      // District roles stop at District and inherit every ULB/RLB under it;
      // local-body roles must pick the concrete ULB/RLB local body.
      const missing: string[] = [];
      if (!values.stateId) missing.push("State");
      if (!isStateScopeSelected && !values.districtId) missing.push("District");
      if (isLocalBodyScopeRequired || isLocalBodyScopeStarted) {
        if (!values.areaTypeId) missing.push("Area Type");
        if (!values.localBodyLevel || !values.localBodyId) missing.push("Local Body");
      }
      if (missing.length) {
        setStepError(`Select ${missing.join(", ")} to define this staff member's data scope.`);
        return false;
      }
    }
    setApiErrors({});
    return true;
  };

  const nextTab = async () => {
    if (!(await validateTab(activeTab))) return;
    const nextIndex = Math.min(activeTab + 1, TABS.length - 1);
    setActiveTab(nextIndex);
    navigate(stepPathFor(nextIndex));
  };

  /**
   * Header tab navigation: moving back to a completed tab is always allowed;
   * moving forward validates the current tab first and advances a single step,
   * so pages must be filled in order.
   */
  const goToTab = async (index: number) => {
    // Edit mode: the record already has every tab filled, so allow free jumps.
    if (isEdit || index <= activeTab) {
      setStepError(null);
      setActiveTab(index);
      navigate(stepPathFor(index));
      return;
    }
    if (!(await validateTab(activeTab))) return;
    const nextIndex = activeTab + 1;
    setActiveTab(nextIndex);
    navigate(stepPathFor(nextIndex));
  };

  const buildPayload = (): StaffAccessConfigPayload => ({
    basicInfo: {
      employeeName: values.employeeName,
      staffConfigName: values.staffConfigName,
      mobileNumber: values.mobileNumber,
      officeEmail: values.officeEmail,
      departmentId: values.departmentId,
      designation: values.designation,
      doj: values.doj,
      activeStatus: values.activeStatus,
    },
    loginConfig: {
      username: values.username,
      password: values.password,
      confirmPassword: values.confirmPassword,
      userTypeId: values.userTypeId,
      governmentUserTypeId: values.governmentUserTypeId,
      loginEnabled: values.loginEnabled,
    },
    permissions: modules,
    dashboardPermissions: widgets,
    dataScope: {
      locationNodes: values.locationNodeIds,
      stateId: values.stateId || null,
      districtId: isStateScopeSelected ? null : values.districtId || null,
      areaTypeId: hasLocalBody ? values.areaTypeId || null : null,
      areaTypeCategory: hasLocalBody ? selectedAreaTypeCategory : null,
      localBodyLevel: (hasLocalBody && values.localBodyLevel
        ? values.localBodyLevel
        : null) as StaffAccessConfigPayload["dataScope"]["localBodyLevel"],
      localBodyId: hasLocalBody ? values.localBodyId || null : null,
    },
  });

  const handleSave = async () => {
    const valid = await trigger();
    if (!valid) return;
    if (!(await validateTab(DATA_SCOPE_TAB))) {
      setActiveTab(DATA_SCOPE_TAB);
      navigate(stepPathFor(DATA_SCOPE_TAB));
      return;
    }
    setSaving(true);
    setApiErrors({});
    try {
      if (isEdit && id) {
        await updateStaffAccess(id, buildPayload());
      } else {
        await createStaffAccess(buildPayload());
      }
      await Swal.fire("Saved", "Staff access configuration saved successfully.", "success");
      navigate(listPath);
    } catch (error) {
      const errorMap = extractErrorMap(error);
      setApiErrors(errorMap);
      Swal.fire("Error", firstApiError(errorMap, "Unable to save staff access configuration."), "error");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: keyof FormValues | string) =>
    (errors[name as keyof FormValues]?.message as string | undefined) ?? apiErrors[name];

  const renderError = (name: keyof FormValues | string) =>
    fieldError(name) ? <p className="mt-1 text-xs text-red-600">{fieldError(name)}</p> : null;

  const renderBasicInfo = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="employeeName">Employee Name</Label>
        <Input id="employeeName" {...register("employeeName", { required: "Employee name is required." })} />
        {renderError("employeeName")}
      </div>
      <div>
        <Label htmlFor="staffConfigName">Staff Config Name</Label>
        <Input
          id="staffConfigName"
          placeholder="e.g. Corporation Admin"
          {...register("staffConfigName", { required: "Staff config name is required." })}
        />
        {renderError("staffConfigName")}
      </div>
      <div>
        <Label htmlFor="mobileNumber">Mobile Number</Label>
        <Input id="mobileNumber" {...register("mobileNumber", { required: "Mobile number is required." })} />
        {renderError("mobileNumber")}
      </div>
      <div>
        <Label htmlFor="officeEmail">Office Email</Label>
        <Input id="officeEmail" type="email" {...register("officeEmail")} />
        {renderError("officeEmail")}
      </div>
      <div>
        <Label htmlFor="doj">Date Of Joining</Label>
        <Input id="doj" type="date" {...register("doj")} />
      </div>
      <div>
        <Label htmlFor="departmentId">Department</Label>
        <Select
          id="departmentId"
          value={values.departmentId}
          onChange={(value) => setValue("departmentId", value)}
          options={departmentOptions}
          placeholder="Select department"
        />
        <input type="hidden" {...register("departmentId", { required: "Department is required." })} />
        {renderError("departmentId")}
      </div>
      <div>
        <Label htmlFor="designation">Designation</Label>
        <Input
          id="designation"
          placeholder="e.g. Sanitary Inspector"
          {...register("designation")}
        />
        {renderError("designation")}
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
        <input type="checkbox" className="h-4 w-4" {...register("activeStatus")} />
        Active
      </label>
    </div>
  );

  const renderLogin = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" {...register("username", { required: "Username is required." })} />
        {renderError("username")}
      </div>
      <div>
        <Label htmlFor="userTypeId">User Type</Label>
        <Select
          id="userTypeId"
          value={values.userTypeId}
          onChange={(value) => setValue("userTypeId", value)}
          options={userTypeOptions}
          placeholder="Select user type"
        />
        <input type="hidden" {...register("userTypeId", { required: "User type is required." })} />
        {renderError("userTypeId")}
      </div>
      <PasswordInput
        id="password"
        label="Password"
        value={values.password}
        onChange={(event) => setValue("password", event.target.value)}
        placeholder="Enter password"
      />
      <div>
        <PasswordInput
          id="confirmPassword"
          label="Confirm Password"
          value={values.confirmPassword}
          onChange={(event) => setValue("confirmPassword", event.target.value)}
          placeholder="Repeat password"
        />
        <input
          type="hidden"
          {...register("password", {
            required: isEdit ? false : "Password is required.",
          })}
        />
        <input
          type="hidden"
          {...register("confirmPassword", {
            required: isEdit ? false : "Confirm password is required.",
            validate: (value) => {
              const password = getValues("password");
              if (isEdit && !password && !value) return true;
              return value === password || "Passwords do not match.";
            },
          })}
        />
        {renderError("confirmPassword")}
      </div>
      <div>
        <Label htmlFor="governmentLevel">Government Level</Label>
        <Select
          id="governmentLevel"
          value={governmentLevel}
          onChange={(value) => {
            setGovernmentLevel(value);
            setValue("governmentUserTypeId", "");
          }}
          options={governmentLevelOptions}
          placeholder="Select government level"
        />
      </div>
      <div>
        <Label htmlFor="governmentUserTypeId">Government User Type</Label>
        <Select
          id="governmentUserTypeId"
          value={values.governmentUserTypeId}
          onChange={(value) => setValue("governmentUserTypeId", value)}
          options={governmentRoleOptions}
          placeholder={governmentLevel ? "Select government user type" : "Select a level first"}
        />
        <input
          type="hidden"
          {...register("governmentUserTypeId", { required: "Government user type is required." })}
        />
        {renderError("governmentUserTypeId")}
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
        <input type="checkbox" className="h-4 w-4" {...register("loginEnabled")} />
        Login Enabled
      </label>
      {apiErrors.governmentUserTypeId && (
        <p className="md:col-span-2 text-xs text-red-600">{apiErrors.governmentUserTypeId}</p>
      )}
    </div>
  );

  const renderPermissions = () => (
    <div className="space-y-6">
      {!canLoadPermissions ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {isLocalBodyScopeRequired
            ? "Select a Local Body on the Data Scope tab first. The screens available here are determined by what Super Admin has enabled for that Local Body."
            : "Select the required geographic boundary on the Data Scope tab first."}
        </div>
      ) : loadingPermissions ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading permissions
        </div>
      ) : (
        <PermissionTree
          modules={modules}
          actions={actionOptions}
          allowedActions={allowedActions}
          onChange={setModules}
        />
      )}
      {hasLocalBody && <DashboardWidgetPanel widgets={widgets} onChange={setWidgets} />}
    </div>
  );

  const renderDataScope = () => (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Geographic scope
        </h4>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {isDistrictScopeSelected ? (
            <>
              Pick <b>State → District</b>. This is the access boundary: the staff member will see
              every Urban Local Body and Rural Local Body under the selected district. To narrow the
              same role further, optionally continue with Area Type → Local Body Type → Local Body.
            </>
          ) : (
            <>
              Pick the full path — <b>State → District → Area Type → Local Body Type → Local Body</b>.
              This is the access boundary: the staff member will only see data under the local body you
              choose. e.g. for a corporation admin/supervisor select
            </>
          )}
          {!isDistrictScopeSelected && (
            <>
              <b> Tamil Nadu → Erode → Urban Local Body → Corporation → Erode Corporation</b>.
            </>
          )}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="stateId">
              State<span className="text-red-500"> *</span>
            </Label>
            <Select
              id="stateId"
              value={values.stateId}
              onChange={(value) => {
                setValue("stateId", value);
                setValue("districtId", "");
                setValue("areaTypeId", "");
                setValue("localBodyLevel", "");
                setValue("localBodyId", "");
              }}
              options={stateOptions}
              placeholder="Select state"
            />
          </div>
          <div>
            <Label htmlFor="districtId">
              District<span className="text-red-500"> *</span>
            </Label>
            <Select
              id="districtId"
              value={values.districtId}
              onChange={(value) => {
                setValue("districtId", value);
                setValue("areaTypeId", "");
                setValue("localBodyLevel", "");
                setValue("localBodyId", "");
              }}
              options={districtOptions}
              placeholder={values.stateId ? "Select district" : "Select a state first"}
              disabled={!values.stateId}
            />
          </div>
          {shouldShowLocalBodyScope && (
            <>
              <div>
                <Label htmlFor="areaTypeId">
                  Area Type{isLocalBodyScopeRequired && <span className="text-red-500"> *</span>}
                </Label>
                <Select
                  id="areaTypeId"
                  value={values.areaTypeId}
                  onChange={(value) => {
                    setValue("areaTypeId", value);
                    setValue("localBodyLevel", "");
                    setValue("localBodyId", "");
                  }}
                  options={areaTypeOptions}
                  placeholder={values.districtId ? "Select area type" : "Select a district first"}
                  disabled={!values.districtId}
                />
              </div>
              <div>
                <Label htmlFor="localBodyLevel">
                  Local Body Type{isLocalBodyScopeRequired && <span className="text-red-500"> *</span>}
                </Label>
                <Select
                  id="localBodyLevel"
                  value={values.localBodyLevel}
                  onChange={(value) => {
                    setValue("localBodyLevel", value as FormValues["localBodyLevel"]);
                    setValue("localBodyId", "");
                  }}
                  options={availableLocalBodyLevels.map((level) => ({ value: level.value, label: level.label }))}
                  placeholder={values.areaTypeId ? "Select local body type" : "Select an area type first"}
                  disabled={!values.areaTypeId}
                />
              </div>
            </>
          )}
          {shouldShowLocalBodyScope && values.localBodyLevel && (
            <div className="md:col-span-2">
              <Label htmlFor="localBodyId">
                {LOCAL_BODY_LEVELS.find((level) => level.value === values.localBodyLevel)?.label}
                {isLocalBodyScopeRequired && <span className="text-red-500"> *</span>}
              </Label>
              <Select
                id="localBodyId"
                value={values.localBodyId}
                onChange={(value) => setValue("localBodyId", value)}
                options={localBodyOptions}
                placeholder="Select"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const reviewValue = (value: string | null | undefined) => value || "-";

  const reviewRow = (label: string, value: string | null | undefined) => (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-800">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="max-w-[65%] truncate text-right font-medium text-gray-800 dark:text-gray-100">
        {reviewValue(value)}
      </span>
    </div>
  );

  const reviewCard = (
    title: string,
    icon: ReactNode,
    children: ReactNode,
  ) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {icon}
        {title}
      </h4>
      <div className="text-sm">{children}</div>
    </div>
  );

  const roleLabel = labelFromOptions(governmentRoleOptions, values.governmentUserTypeId);
  const userTypeLabel = labelFromOptions(userTypeOptions, values.userTypeId);
  const localBodyLevelLabel =
    LOCAL_BODY_LEVELS.find((level) => level.value === values.localBodyLevel)?.label || "";
  const localBodyLabel = labelFromOptions(localBodyOptions, values.localBodyId);
  const enabledScreens = modules.flatMap((module) =>
    module.enabled
      ? module.screens
          .map((screen) => {
            const selectedActions = actionOptions
              .filter((action) => screen.actions[action.value])
              .map((action) => action.label.toLowerCase());
            return {
              moduleName: module.mainScreenName,
              screenName: screen.userScreenName || screen.userScreenId,
              actions: selectedActions,
            };
          })
          .filter((screen) => screen.actions.length > 0)
      : [],
  );
  const enabledWidgets = widgets.filter((widget) => widget.isEnabled);

  const renderReview = () => (
    <div className="space-y-6">
      {reviewCard(
        "Basic info",
        <UserRound className="h-4 w-4 text-gray-500" />,
        <>
          {reviewRow("Name", values.employeeName)}
          {reviewRow("Staff config", values.staffConfigName)}
          {reviewRow("Mobile", values.mobileNumber)}
          {reviewRow("Email", values.officeEmail)}
          {reviewRow("Department", labelFromOptions(departmentOptions, values.departmentId))}
          {reviewRow("Designation", values.designation)}
          {reviewRow("Date of joining", values.doj)}
          {reviewRow("Status", values.activeStatus ? "Active" : "Inactive")}
        </>,
      )}

      {reviewCard(
        "Role & login",
        <ShieldCheck className="h-4 w-4 text-gray-500" />,
        <>
          {reviewRow("Username", values.username)}
          {reviewRow("User type", userTypeLabel)}
          {reviewRow("Government level", governmentLevelOptions.find((option) => option.value === governmentLevel)?.label)}
          {reviewRow("Role", roleLabel)}
          {reviewRow("Account", values.loginEnabled ? "Enabled" : "Disabled")}
        </>,
      )}

      {reviewCard(
        "Permissions granted",
        <KeyRound className="h-4 w-4 text-gray-500" />,
        enabledScreens.length ? (
          <div className="flex flex-wrap gap-2">
            {enabledScreens.slice(0, 18).map((screen) => (
              <span
                key={`${screen.moduleName}-${screen.screenName}`}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
              >
                {screen.screenName}
                {screen.actions.length ? ` - ${screen.actions.join(", ")}` : ""}
              </span>
            ))}
            {enabledScreens.length > 18 && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                +{enabledScreens.length - 18} more
              </span>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No screens enabled</p>
        ),
      )}

      {reviewCard(
        "Dashboard widgets",
        <CheckCircle2 className="h-4 w-4 text-gray-500" />,
        enabledWidgets.length ? (
          <div className="flex flex-wrap gap-2">
            {enabledWidgets.map((widget) => (
              <span
                key={widget.widgetName}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                {widget.widgetName.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No widgets enabled</p>
        ),
      )}

      {reviewCard(
        "Data scope",
        <MapPinned className="h-4 w-4 text-gray-500" />,
        <>
          {reviewRow("Access boundary", dataScopeBoundaryLabel)}
          {reviewRow("State", labelFromOptions(stateOptions, values.stateId))}
          {!isStateScopeSelected && reviewRow("District", labelFromOptions(districtOptions, values.districtId))}
          {hasLocalBody && (
            <>
              {reviewRow("Area type", labelFromOptions(areaTypeOptions, values.areaTypeId))}
              {reviewRow("Local body type", localBodyLevelLabel)}
              {reviewRow(localBodyLevelLabel || "Local body", localBodyLabel)}
            </>
          )}
        </>,
      )}

      {Object.keys(apiErrors).length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {Object.entries(apiErrors).map(([key, value]) => (
            <p key={key}>{key}: {value}</p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            const previousIndex = Math.max(activeTab - 1, 0);
            setActiveTab(previousIndex);
            navigate(stepPathFor(previousIndex));
          }}
          className={SECONDARY_BUTTON_CLASS}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => navigate(listPath)}
          className={CANCEL_BUTTON_CLASS}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={PRIMARY_BUTTON_CLASS}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm &amp; Save
        </button>
      </div>
    </div>
  );

  return (
    <ComponentCard
      title="Staff Access Configuration"
      desc={loadingOptions ? "Loading configuration options..." : ""}
    >
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
        {TABS.map((tab, index) => {
          const isActive = activeTab === index;
          const isCompleted = index < activeTab;
          const isLocked = index > activeTab && !isEdit;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => void goToTab(index)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "!bg-[#22a855] !text-white shadow-sm"
                  : isCompleted
                    ? "!bg-[#e8f8ee] !text-[#22a855] hover:opacity-90"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                  ? "bg-white/20 text-white"
                  : isCompleted
                      ? "!bg-[#22a855] !text-white"
                      : "bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {isCompleted ? "✓" : index + 1}
              </span>
              {tab}
              {isLocked && <span className="text-[10px] opacity-60">🔒</span>}
            </button>
          );
        })}
      </div>

      <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
        {activeTab === 0 && renderBasicInfo()}
        {activeTab === 1 && renderLogin()}
        {activeTab === DATA_SCOPE_TAB && renderDataScope()}
        {activeTab === PERMISSIONS_TAB && renderPermissions()}
        {activeTab === 4 && renderReview()}

        {activeTab < TABS.length - 1 && (
          <div className="flex flex-col gap-2">
            {stepError && (
              <p className="max-w-full whitespace-normal break-words text-left text-sm font-medium text-red-600 dark:text-red-400">
                {stepError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(listPath)}
                className={CANCEL_BUTTON_CLASS}
              >
                Cancel
              </button>
              {activeTab > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStepError(null);
                    const previousIndex = Math.max(activeTab - 1, 0);
                    setActiveTab(previousIndex);
                    navigate(stepPathFor(previousIndex));
                  }}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={nextTab}
                className={PRIMARY_BUTTON_CLASS}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </form>
    </ComponentCard>
  );
}
