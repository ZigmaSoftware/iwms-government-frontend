/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  contractorRoleTypesApi,
  contractorUserTypeApi,
  governmentUserTypeApi,
  roleTypesApi,
  staffUserTypeApi,
  userTypeApi,
} from "@/helpers/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserTypeOption = { unique_id: string; name: string; is_active: boolean };
type RoleOption = { value: string; label: string };

type GovtRecord = {
  unique_id: string;
  name: string;         // raw key e.g. "govt_state_admin"
  name_display: string; // human label e.g. "State Admin"
  level: string;         // raw key e.g. "state"
  level_display: string; // human label e.g. "State"
  usertype_id: any;
  is_active: boolean;
};

type Category = "staff" | "contractor" | "government";

type InitialPayload = {
  usertype_id: string;
  name: string;
  level: string;
  is_active: boolean;
  category: Category;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prettifyLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const toRoleOption = (item: unknown): RoleOption | null => {
  if (typeof item === "string") {
    const v = item.trim();
    return v ? { value: v, label: prettifyLabel(v) } : null;
  }
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const rawV = r.value ?? r.key ?? r.id ?? r.unique_id ?? r.name ?? r.code;
  if (typeof rawV !== "string" && typeof rawV !== "number") return null;
  const v = String(rawV).trim();
  if (!v) return null;
  const rawL = r.label ?? r.display_name ?? r.title ?? r.name;
  const label = typeof rawL === "string" && rawL.trim() ? rawL : prettifyLabel(v);
  return { value: v, label };
};

const normalizeRoleTypes = (raw: unknown): RoleOption[] => {
  const payload =
    raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as any).data
      : raw;

  let source: unknown[] = [];
  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    for (const key of ["results", "choices", "role_choices", "items", "data"]) {
      if (Array.isArray(rec[key])) { source = rec[key] as unknown[]; break; }
    }
  }

  const parsed = source.map(toRoleOption).filter((x): x is RoleOption => Boolean(x));
  const seen = new Map<string, RoleOption>();
  for (const o of parsed) if (!seen.has(o.value)) seen.set(o.value, o);
  return Array.from(seen.values());
};

const toRecordList = (v: unknown): any[] => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const r = v as Record<string, unknown>;
    if (Array.isArray(r.results)) return r.results;
    if (Array.isArray(r.data)) return r.data;
  }
  return [];
};

const normalizeId = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "object") {
    const r = v as Record<string, unknown>;
    return normalizeId(r.unique_id ?? r.id ?? r.value);
  }
  return String(v).trim();
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as any)?.response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object")
    return Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("\n");
  return fallback;
};

// ─── Inner Editor (district-style: initialised once via key remount) ──────────

type EditorProps = {
  initialPayload: InitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  userTypes: UserTypeOption[];
  staffRoles: RoleOption[];
  contractorRoles: RoleOption[];
  govtRecords: GovtRecord[];
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>, category: Category) => Promise<void>;
};

function StaffUserTypeEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  userTypes,
  staffRoles,
  contractorRoles,
  govtRecords,
  onCancel,
  onSubmit,
}: EditorProps) {
  const { t } = useTranslation();

  const [selectedUserType, setSelectedUserType] = useState(initialPayload.usertype_id);
  const [name, setName]                         = useState(initialPayload.name);
  const [selectedLevel, setSelectedLevel]       = useState(initialPayload.level);
  const [isActive, setIsActive]                 = useState(initialPayload.is_active);

  const selectedUserTypeName =
    userTypes.find((u) => u.unique_id === selectedUserType)?.name?.toLowerCase() ?? "";
  const isContractor = selectedUserTypeName === "contractor";
  const isGovernment = selectedUserTypeName === "government";

  // Unique level options derived from the seeded govt records
  const levelOptions: RoleOption[] = useMemo(() => {
    const seen = new Set<string>();
    const out: RoleOption[] = [];
    for (const r of govtRecords) {
      if (!seen.has(r.level)) {
        seen.add(r.level);
        out.push({ value: r.level, label: r.level_display ?? prettifyLabel(r.level) });
      }
    }
    return out;
  }, [govtRecords]);

  // Roles filtered by the selected level
  const govtRoleOptions: RoleOption[] = useMemo(() => {
    if (!selectedLevel) return [];
    return govtRecords
      .filter((r) => r.level === selectedLevel)
      .map((r) => ({
        value: r.name,
        label: r.name_display ?? prettifyLabel(r.name),
      }));
  }, [selectedLevel, govtRecords]);

  const roleOptions = isGovernment
    ? govtRoleOptions
    : isContractor
    ? contractorRoles
    : staffRoles;

  // When user type changes, reset dependent fields
  const handleUserTypeChange = (newId: string) => {
    setSelectedUserType(newId);
    setName("");
    setSelectedLevel("");
  };

  // When level changes, reset role
  const handleLevelChange = (newLevel: string) => {
    setSelectedLevel(newLevel);
    setName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserType || !name) {
      Swal.fire(t("common.error"), t("common.all_fields_required"), "error");
      return;
    }
    if (isGovernment && !selectedLevel) {
      Swal.fire(t("common.error"), "Please select a government level.", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      usertype_id: selectedUserType,
      name,
      is_active: isActive,
    };
    if (isGovernment) payload.level = selectedLevel;

    const category: Category = isGovernment ? "government" : isContractor ? "contractor" : "staff";
    await onSubmit(payload, category);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Type */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("admin.nav.user_type")} <span className="text-red-500">*</span>
          </label>
          <Select
            value={selectedUserType}
            onValueChange={handleUserTypeChange}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t("common.select_item_placeholder", { item: t("admin.nav.user_type") })}
              />
            </SelectTrigger>
            <SelectContent>
              {userTypes.map((u) => (
                <SelectItem key={u.unique_id} value={u.unique_id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Government Level — only when Government is selected */}
        {isGovernment && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Government Level <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedLevel}
              onValueChange={handleLevelChange}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Level" />
              </SelectTrigger>
              <SelectContent>
                {levelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Role — filtered by level for Government */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t("admin.staff_user_type.role_label")} <span className="text-red-500">*</span>
          </label>
          <Select
            value={name}
            onValueChange={setName}
            disabled={isSubmitting || (isGovernment && !selectedLevel)}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isGovernment && !selectedLevel
                    ? "Select a level first"
                    : t("common.select_role")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.length === 0 ? (
                <SelectItem value="__no_roles__" disabled>
                  {t("common.not_available")}
                </SelectItem>
              ) : (
                roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status */}
      <div className="w-full md:w-1/3">
        <label className="block text-sm font-medium mb-1">
          {t("common.status")} <span className="text-red-500">*</span>
        </label>
        <Select
          value={isActive ? "true" : "false"}
          onValueChange={(v) => setIsActive(v === "true")}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t("common.active")}</SelectItem>
            <SelectItem value="false">{t("common.inactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit ? t("common.updating") : t("common.saving")
            : isEdit ? t("common.update")   : t("common.save")}
        </Button>
        <Button type="button" variant="destructive" onClick={onCancel} disabled={isSubmitting}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

// ─── Container (loads data, builds initialPayload, uses formKey trick) ────────

export default function StaffUserTypeForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { encAdmins, encStaffUserType } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encAdmins, encStaffUserType);

  // ── dropdown data ──
  const [userTypes, setUserTypes]           = useState<UserTypeOption[]>([]);
  const [staffRoles, setStaffRoles]         = useState<RoleOption[]>([]);
  const [contractorRoles, setContractorRoles] = useState<RoleOption[]>([]);
  const [govtRecords, setGovtRecords]       = useState<GovtRecord[]>([]);
  const [dataLoaded, setDataLoaded]         = useState(false);

  // ── edit record ──
  const [recordData, setRecordData]   = useState<any>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all dropdowns in parallel
  useEffect(() => {
    Promise.allSettled([
      userTypeApi.readAll(),
      roleTypesApi.readAll(),
      contractorRoleTypesApi.readAll(),
      governmentUserTypeApi.readAll(),
    ]).then(([utRes, staffRes, contractorRes, govtRes]) => {
      if (utRes.status === "fulfilled") {
        const list = toRecordList(utRes.value) as UserTypeOption[];
        setUserTypes(list.filter((u) => u.unique_id));
      }
      if (staffRes.status === "fulfilled")
        setStaffRoles(normalizeRoleTypes(staffRes.value));
      if (contractorRes.status === "fulfilled")
        setContractorRoles(normalizeRoleTypes(contractorRes.value));
      if (govtRes.status === "fulfilled")
        setGovtRecords(toRecordList(govtRes.value) as GovtRecord[]);
      setDataLoaded(true);
    });
  }, []);

  // Load edit record
  useEffect(() => {
    if (!isEdit || !id) return;
    const normalizedId = id.toUpperCase();
    const api =
      normalizedId.startsWith("GOVTUSRTYPE-") ? governmentUserTypeApi
      : normalizedId.startsWith("CNTUSRTYPE-") ? contractorUserTypeApi
      : staffUserTypeApi;

    setRecordLoading(true);
    api
      .read(id)
      .then((res: any) => setRecordData(res))
      .catch(() =>
        Swal.fire({ icon: "error", title: t("common.error"), text: t("common.load_failed") })
      )
      .finally(() => setRecordLoading(false));
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // formKey: changes once recordData arrives, causing StaffUserTypeEditor to remount
  // with correct initialPayload (same pattern as DistrictForm)
  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new";

  const buildInitialPayload = (): InitialPayload => {
    if (!recordData) {
      return { usertype_id: "", name: "", level: "", is_active: true, category: "staff" };
    }
    const uid = recordData.unique_id ?? "";
    const category: Category =
      String(uid).toUpperCase().startsWith("GOVTUSRTYPE-") ? "government"
      : String(uid).toUpperCase().startsWith("CNTUSRTYPE-") ? "contractor"
      : "staff";

    return {
      usertype_id: normalizeId(recordData.usertype_id ?? recordData.usertype),
      name: String(recordData.name ?? ""),
      level: String(recordData.level ?? ""),
      is_active: recordData.is_active !== false,
      category,
    };
  };

  const handleSubmit = async (payload: Record<string, unknown>, category: Category) => {
    setIsSubmitting(true);
    try {
      if (category === "government") {
        if (isEdit && id) await governmentUserTypeApi.update(id, payload);
        else await governmentUserTypeApi.create(payload);
      } else if (category === "contractor") {
        if (isEdit && id) await contractorUserTypeApi.update(id, payload);
        else await contractorUserTypeApi.create(payload);
      } else {
        if (isEdit && id) await staffUserTypeApi.update(id, payload);
        else await staffUserTypeApi.create(payload);
      }
      Swal.fire({
        icon: "success",
        title: isEdit ? t("common.updated_success") : t("common.added_success"),
        timer: 1500,
        showConfirmButton: false,
      });
      navigate(LIST_PATH);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: extractErrorMessage(
          error,
          (error as any)?.response?.data?.name?.[0] ??
          (error as any)?.response?.data?.usertype_id?.[0] ??
          t("common.invalid_data")
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isEdit
    ? t("common.edit_item", { item: t("admin.nav.staff_user_type") })
    : t("common.add_item", { item: t("admin.nav.staff_user_type") });

  // Show loading until both data and edit record are ready
  const isReady = dataLoaded && (!isEdit || !recordLoading || recordData !== null);

  if (!isReady) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard title={title}>
      <StaffUserTypeEditor
        key={formKey}
        initialPayload={buildInitialPayload()}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        userTypes={userTypes}
        staffRoles={staffRoles}
        contractorRoles={contractorRoles}
        govtRecords={govtRecords}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={handleSubmit}
      />
    </ComponentCard>
  );
}
