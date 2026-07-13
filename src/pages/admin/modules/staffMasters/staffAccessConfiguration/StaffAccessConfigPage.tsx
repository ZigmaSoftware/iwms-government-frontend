import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, KeyRound, Loader2, MapPinned, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

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
} from "../../masters/shared/dataScopeOptions";
import type { ScopeLevel } from "../../masters/shared/dataScopeOptions";

type FormValues = {
  employeeName: string;
  mobileNumber: string;
  officeEmail: string;
  departmentId: string;
  designationId: string;
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
  depotId: string;
  vehicleId: string;
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
  panchayat_name?: string;
  name_display?: string;
  level?: string;
  level_display?: string;
};

const TABS = ["Basic Info", "Login", "Data Scope", "Permissions", "Review"] as const;
const DATA_SCOPE_TAB = 2;
const PERMISSIONS_TAB = 3;

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
  mobileNumber: "",
  officeEmail: "",
  departmentId: "",
  designationId: "",
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
  depotId: "",
  vehicleId: "",
};

const optionLabel = (record: ApiOptionRecord) =>
  record.employee_name ??
  record.department_name ??
  record.designation_name ??
  record.corporation_name ??
  record.municipality_name ??
  record.town_panchayat_name ??
  record.panchayat_union_name ??
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
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encStaffMasters, encStaffAccessConfiguration } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encStaffMasters, encStaffAccessConfiguration);

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

  const [userTypes, setUserTypes] = useState<ApiOptionRecord[]>([]);
  const [governmentRoles, setGovernmentRoles] = useState<ApiOptionRecord[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([]);
  const [designationOptions, setDesignationOptions] = useState<SelectOption[]>([]);
  const [depotOptions, setDepotOptions] = useState<SelectOption[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<SelectOption[]>([]);

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
          departmentRes,
          designationRes,
          hierarchyRes,
          vehicleRes,
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
          adminApi.departments.readAll(),
          adminApi.designations.readAll(),
          adminApi.hierarchies.readAll(),
          adminApi.vehicleCreations.readAll(),
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
        setDepartmentOptions(toOptions(valueOrEmpty(departmentRes) as ApiOptionRecord[]));
        setDesignationOptions(toOptions(valueOrEmpty(designationRes) as ApiOptionRecord[]));
        setDepotOptions(toOptions(valueOrEmpty(hierarchyRes) as ApiOptionRecord[]));
        setVehicleOptions(toOptions(valueOrEmpty(vehicleRes) as ApiOptionRecord[]));
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
        setValue("mobileNumber", String(basicInfo.mobileNumber ?? record.contact_mobile ?? ""));
        setValue("officeEmail", String(basicInfo.officeEmail ?? record.contact_email ?? ""));
        setValue("departmentId", String(basicInfo.departmentId ?? record.department_id ?? ""));
        setValue("designationId", String(basicInfo.designationId ?? record.designation_id ?? ""));
        setValue("doj", String(basicInfo.doj ?? record.doj ?? ""));
        setValue("activeStatus", Boolean(basicInfo.activeStatus ?? record.active_status ?? true));
        setValue("username", String(loginConfig.username ?? record.username ?? ""));
        setValue("password", "");
        setValue("confirmPassword", "");
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
        setValue("depotId", String(dataScope.depotId ?? ""));
        setValue("vehicleId", String(dataScope.vehicleId ?? ""));

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

  useEffect(() => {
    if (activeTab !== PERMISSIONS_TAB || !hasLocalBody) return;
    let cancelled = false;
    const loadPermissions = async () => {
      setLoadingPermissions(true);
      try {
        const localBodyScope = {
          localBodyType: values.localBodyLevel.replace(/_id$/, ""),
          localBodyId: values.localBodyId,
          stateId: values.stateId,
          districtId: values.districtId,
          areaTypeId: values.areaTypeId,
        };

        const [nextActions, rawActions, enabledWidgets] = await Promise.all([
          fetchUserScreenActions(),
          fetchRawUserScreenActions(),
          fetchDashboardWidgetsForLocalBody(localBodyScope),
        ]);
        const { modules: enabledModules, allowedActions: nextAllowedActions } =
          await fetchEnabledScreensForLocalBody(localBodyScope, rawActions);
        if (cancelled) return;

        setActionOptions(nextActions);
        setAllowedActions(nextAllowedActions);

        // Seed from the CURRENT Super Admin ceiling (so a module/screen
        // enabled since the staff was last saved still appears), overlaying
        // the staff's previously-saved selections on top (edit mode) — a
        // screen/action disabled since the staff was last saved must not
        // silently reappear as checked.
        const seeded = savedPermissionModules
          ? applyAllowedActionsCeiling(enabledModules, savedPermissionModules)
          : enabledModules;
        setModules(seeded.length ? seeded : enabledModules);

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
    hasLocalBody,
    values.localBodyLevel,
    values.localBodyId,
    values.stateId,
    values.districtId,
    values.areaTypeId,
    savedPermissionModules,
    savedWidgets,
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

  const currentTabFields = () => {
    if (activeTab === 0) {
      return ["employeeName", "mobileNumber", "departmentId", "designationId"] as const;
    }
    if (activeTab === 1) {
      return ["username", "password", "confirmPassword", "userTypeId", "governmentUserTypeId"] as const;
    }
    return [] as const;
  };

  const nextTab = async () => {
    const valid = await trigger(currentTabFields());
    if (!valid) return;
    if (
      activeTab === 1 &&
      (getValues("password") || getValues("confirmPassword")) &&
      getValues("password") !== getValues("confirmPassword")
    ) {
      setApiErrors({ confirmPassword: "Passwords do not match." });
      return;
    }
    setApiErrors({});
    setActiveTab((tab) => Math.min(tab + 1, TABS.length - 1));
  };

  const buildPayload = (): StaffAccessConfigPayload => ({
    basicInfo: {
      employeeName: values.employeeName,
      mobileNumber: values.mobileNumber,
      officeEmail: values.officeEmail,
      departmentId: values.departmentId,
      designationId: values.designationId,
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
      stateId: values.stateId || null,
      districtId: values.districtId || null,
      areaTypeId: values.areaTypeId || null,
      areaTypeCategory: selectedAreaTypeCategory,
      localBodyLevel: (values.localBodyLevel || null) as StaffAccessConfigPayload["dataScope"]["localBodyLevel"],
      localBodyId: values.localBodyId || null,
      depotId: values.depotId || null,
      vehicleId: values.vehicleId || null,
    },
  });

  const handleSave = async () => {
    const valid = await trigger();
    if (!valid) return;
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
        <Label htmlFor="designationId">Designation</Label>
        <Select
          id="designationId"
          value={values.designationId}
          onChange={(value) => setValue("designationId", value)}
          options={designationOptions}
          placeholder="Select designation"
        />
        <input type="hidden" {...register("designationId", { required: "Designation is required." })} />
        {renderError("designationId")}
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
      {!hasLocalBody ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Select a Local Body on the Data Scope tab first — the screens available here are determined by what Super Admin has enabled for that Local Body.
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
      <DashboardWidgetPanel widgets={widgets} onChange={setWidgets} />
    </div>
  );

  const renderDataScope = () => (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Geographic scope
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="stateId">State</Label>
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
            <Label htmlFor="districtId">District</Label>
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
          <div>
            <Label htmlFor="areaTypeId">Area Type</Label>
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
            <Label htmlFor="localBodyLevel">Local Body</Label>
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
          {values.localBodyLevel && (
            <div className="md:col-span-2">
              <Label htmlFor="localBodyId">
                {LOCAL_BODY_LEVELS.find((level) => level.value === values.localBodyLevel)?.label}
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

      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Asset assignment</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="depotId">Depot</Label>
            <Select
              id="depotId"
              value={values.depotId}
              onChange={(value) => setValue("depotId", value)}
              options={depotOptions}
              placeholder="Select depot"
            />
          </div>
          <div>
            <Label htmlFor="vehicleId">Vehicle</Label>
            <Select
              id="vehicleId"
              value={values.vehicleId}
              onChange={(value) => setValue("vehicleId", value)}
              options={vehicleOptions}
              placeholder="Select vehicle"
            />
          </div>
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
          {reviewRow("Mobile", values.mobileNumber)}
          {reviewRow("Email", values.officeEmail)}
          {reviewRow("Department", labelFromOptions(departmentOptions, values.departmentId))}
          {reviewRow("Designation", labelFromOptions(designationOptions, values.designationId))}
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
          {reviewRow("State", labelFromOptions(stateOptions, values.stateId))}
          {reviewRow("District", labelFromOptions(districtOptions, values.districtId))}
          {reviewRow("Area type", labelFromOptions(areaTypeOptions, values.areaTypeId))}
          {reviewRow("Local body type", localBodyLevelLabel)}
          {reviewRow(localBodyLevelLabel || "Local body", localBodyLabel)}
          {reviewRow("Depot", labelFromOptions(depotOptions, values.depotId))}
          {reviewRow("Vehicle", labelFromOptions(vehicleOptions, values.vehicleId))}
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
          onClick={() => navigate(listPath)}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm & Save
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
        {TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(index)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeTab === index
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
        {activeTab === 0 && renderBasicInfo()}
        {activeTab === 1 && renderLogin()}
        {activeTab === DATA_SCOPE_TAB && renderDataScope()}
        {activeTab === PERMISSIONS_TAB && renderPermissions()}
        {activeTab === 4 && renderReview()}

        {activeTab < TABS.length - 1 && (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(listPath)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Cancel
            </button>
            {activeTab > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab((tab) => Math.max(tab - 1, 0))}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={nextTab}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Next
            </button>
          </div>
        )}
      </form>
    </ComponentCard>
  );
}
