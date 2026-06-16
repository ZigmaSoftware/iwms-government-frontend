import type { RoleTypeOption, UserType } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getEncryptedRoute } from "@/utils/routeCache";
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
  roleTypesApi,
  staffUserTypeApi,
  userTypeApi,
} from "@/helpers/admin";

const { encAdmins, encStaffUserType } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAdmins, encStaffUserType);


const normalizeIdValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeIdValue(record.unique_id ?? record.id ?? record.value);
  }
  return String(value).trim();
};

const prettifyRoleLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

/* ------------------------------------------------------------------
   Normalize role-choices response (same logic as tanstack roleTypes.ts)
------------------------------------------------------------------ */
const toRoleOption = (item: unknown): RoleTypeOption | null => {
  if (typeof item === "string") {
    const value = item.trim();
    if (!value) return null;
    return { value, label: prettifyRoleLabel(value) };
  }
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const rawValue =
    record.value ?? record.key ?? record.id ?? record.unique_id ?? record.name ?? record.code;
  if (typeof rawValue !== "string" && typeof rawValue !== "number") return null;
  const value = String(rawValue).trim();
  if (!value) return null;
  const rawLabel = record.label ?? record.display_name ?? record.title ?? record.name;
  const label =
    typeof rawLabel === "string" && rawLabel.trim() ? rawLabel : prettifyRoleLabel(value);
  return { value, label };
};

const normalizeRoleTypes = (raw: unknown): RoleTypeOption[] => {
  const payload =
    raw && typeof raw === "object" && raw !== null && "data" in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).data
      : raw;

  let source: unknown[] = [];

  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const arrayKeys = ["results", "choices", "role_choices", "items", "data"];
    for (const key of arrayKeys) {
      if (Array.isArray(record[key])) {
        source = record[key] as unknown[];
        break;
      }
    }
    if (source.length === 0) {
      const entries = Object.entries(record).filter(
        ([key]) => !["count", "next", "previous", "detail", "message"].includes(key),
      );
      if (entries.length > 0 && entries.every(([, value]) => typeof value === "string")) {
        source = entries.map(([value, label]) => ({ value, label }));
      }
    }
  }

  const parsed = source.map((item) => toRoleOption(item)).filter((item): item is RoleTypeOption => Boolean(item));
  const unique = new Map<string, RoleTypeOption>();
  for (const option of parsed) {
    if (!unique.has(option.value)) unique.set(option.value, option);
  }
  return Array.from(unique.values());
};

const normalizeContractorRoleTypes = (raw: unknown): RoleTypeOption[] => {
  const payload =
    raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).data
      : raw;

  let source: unknown[] = [];

  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["results", "choices", "items", "data"]) {
      if (Array.isArray(record[key])) {
        source = record[key] as unknown[];
        break;
      }
    }
  }

  return source
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      value: String(item.value ?? "").trim(),
      label: String(item.label ?? item.value ?? "").trim(),
    }))
    .filter((opt) => opt.value);
};

const ensureRoleOption = (
  roles: RoleTypeOption[],
  roleValue: string
): RoleTypeOption[] => {
  if (!roleValue || roles.some((role) => role.value === roleValue)) {
    return roles;
  }

  return [
    ...roles,
    {
      value: roleValue,
      label: prettifyRoleLabel(roleValue),
    },
  ];
};

export default function StaffUserTypeForm() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [roleTypes, setRoleTypes] = useState<RoleTypeOption[]>([]);
  const [selectedUserType, setSelectedUserType] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [pageReady, setPageReady] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const skipUserTypeResetRef = useRef(false);

  const selectedUserTypeName = userTypes
    .find((u) => u.unique_id === selectedUserType)
    ?.name?.toLowerCase() ?? "";
  const isContractor = selectedUserTypeName === "contractor";

  /* -------------------------------------------------------
     Loaded data state
  ------------------------------------------------------- */
  const [staffRoleChoices, setStaffRoleChoices] = useState<RoleTypeOption[]>([]);
  const [contractorRoleChoices, setContractorRoleChoices] = useState<RoleTypeOption[]>([]);
  const [staffRecordData, setStaffRecordData] = useState<any>(null);
  const [contractorRecordData, setContractorRecordData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* -------------------------------------------------------
     Loading flags for init guard
  ------------------------------------------------------- */
  const [userTypesLoaded, setUserTypesLoaded] = useState(false);
  const [staffRolesLoaded, setStaffRolesLoaded] = useState(false);
  const [contractorRolesLoaded, setContractorRolesLoaded] = useState(false);
  const [editRecordLoaded, setEditRecordLoaded] = useState(!isEdit);

  /* -------------------------------------------------------
     FETCH DROPDOWNS
  ------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    userTypeApi.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setUserTypes(Array.isArray(res) ? res : (res?.results ?? []));
        setUserTypesLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setUserTypesLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    roleTypesApi.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setStaffRoleChoices(normalizeRoleTypes(res));
        setStaffRolesLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setStaffRolesLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    contractorRoleTypesApi.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setContractorRoleChoices(normalizeContractorRoleTypes(res));
        setContractorRolesLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setContractorRolesLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  /* -------------------------------------------------------
     FETCH EDIT RECORD (staff or contractor — we don't know
     which until userTypes are loaded, so try both and use
     whichever returns a valid record)
  ------------------------------------------------------- */
  useEffect(() => {
    if (!isEdit || !id) {
      setEditRecordLoaded(true);
      return;
    }
    const normalizedId = String(id).toUpperCase();
    const primaryApi = normalizedId.startsWith("STUSRTYPE-")
      ? staffUserTypeApi
      : normalizedId.startsWith("CNTUSRTYPE-")
        ? contractorUserTypeApi
        : null;

    let cancelled = false;

    if (primaryApi) {
      primaryApi.read(id)
        .then((record: any) => {
          if (cancelled) return;
          if (normalizedId.startsWith("CNTUSRTYPE-")) {
            setContractorRecordData(record);
          } else {
            setStaffRecordData(record);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setEditRecordLoaded(true);
        });

      return () => { cancelled = true; };
    }

    Promise.allSettled([staffUserTypeApi.read(id), contractorUserTypeApi.read(id)])
      .then(([staffResult, contractorResult]) => {
        if (cancelled) return;
        if (staffResult.status === "fulfilled" && staffResult.value) {
          setStaffRecordData(staffResult.value);
        }
        if (contractorResult.status === "fulfilled" && contractorResult.value) {
          setContractorRecordData(contractorResult.value);
        }
      })
      .finally(() => {
        if (!cancelled) setEditRecordLoaded(true);
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  /* =========================
     Swap role choices when user type changes (after page is ready)
  ========================= */
  useEffect(() => {
    if (!pageReady) return;
    const roles = isContractor ? contractorRoleChoices : staffRoleChoices;
    if (skipUserTypeResetRef.current) {
      skipUserTypeResetRef.current = false;
      return;
    }
    setRoleTypes(roles);
    setName(roles[0]?.value ?? "");
  }, [selectedUserType]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================
     INIT
  ========================= */
  useEffect(() => {
    if (pageReady) return;
    if (!userTypesLoaded || !staffRolesLoaded || !contractorRolesLoaded || !editRecordLoaded) return;

    const ut = userTypes;
    if (!isEdit && ut.length > 0 && !selectedUserType) {
      setSelectedUserType(ut[0].unique_id);
    }

    const editData = staffRecordData ?? contractorRecordData;
    const isContractorRecord = Boolean(contractorRecordData && !staffRecordData);
    const fallbackUserTypeId =
      ut.find((u) => u.name?.toLowerCase?.().trim() === (isContractorRecord ? "contractor" : "staff"))
        ?.unique_id ?? "";

    // Determine role choices based on record (or default staff)
    const roles = isContractorRecord ? contractorRoleChoices : staffRoleChoices;
    setRoleTypes(roles);

    if (isEdit) {
      const data = editData as any;
      if (!data) {
        setPageReady(true);
        return;
      }

      const roleValue = String(data.name ?? "").trim();
      const recordUserTypeId = normalizeIdValue(data.usertype_id ?? data.usertype);
      setName(roleValue);
      setIsActive(Boolean(data.is_active));

      if (recordUserTypeId || fallbackUserTypeId) {
        const nextUserTypeId = recordUserTypeId || fallbackUserTypeId;
        skipUserTypeResetRef.current = true;
        setSelectedUserType(nextUserTypeId);
        // Re-derive roles based on the record's user type
        const matchedUt = ut.find((u) => u.unique_id === nextUserTypeId);
        const matchedIsContractor = matchedUt?.name?.toLowerCase() === "contractor";
        const matchedRoles = matchedIsContractor ? contractorRoleChoices : staffRoleChoices;
        setRoleTypes(ensureRoleOption(matchedRoles, roleValue));
      } else {
        setRoleTypes(ensureRoleOption(roles, roleValue));
      }
    } else {
      if (!name && roles.length > 0) {
        setName(roles[0].value);
      }
    }

    setPageReady(true);
  }, [userTypesLoaded, staffRolesLoaded, contractorRolesLoaded, editRecordLoaded, pageReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================
     SUBMIT
  ========================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserType || !name) {
      Swal.fire(t("common.error"), t("common.all_fields_required"), "error");
      return;
    }

    const payload = {
      usertype_id: selectedUserType,
      name,
      is_active: isActive,
    };

    setIsSubmitting(true);
    try {
      if (isContractor) {
        if (isEdit) {
          await contractorUserTypeApi.update(id as string, payload);
        } else {
          await contractorUserTypeApi.create(payload);
        }
      } else {
        if (isEdit) {
          await staffUserTypeApi.update(id as string, payload);
        } else {
          await staffUserTypeApi.create(payload);
        }
      }

      Swal.fire(t("common.success"), isEdit ? t("common.updated_success") : t("common.added_success"), "success");
      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      Swal.fire(
        t("common.error"),
        error.response?.data?.name?.[0] ??
          error.response?.data?.usertype_id?.[0] ??
          t("common.invalid_data"),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================
     GUARD
  ========================= */
  if (!pageReady) return null;

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="p-8">
      <div className=" mx-auto bg-white rounded-xl shadow-md border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">
            {isEdit
              ? t("common.edit_item", { item: t("admin.nav.staff_user_type") })
              : t("common.add_item", { item: t("admin.nav.staff_user_type") })}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* ROW 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* USER TYPE */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("admin.nav.user_type")}{" "}
                <span className="text-red-500">*</span>
              </label>

              <Select
                value={selectedUserType}
                onValueChange={setSelectedUserType}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("common.select_item_placeholder", {
                      item: t("admin.nav.user_type"),
                    })}
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

            {/* STAFF ROLE */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("admin.staff_user_type.role_label")}{" "}
                <span className="text-red-500">*</span>
              </label>

              <Select value={name} onValueChange={setName}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select_role")} />
                </SelectTrigger>
                <SelectContent>
                  {roleTypes.length === 0 ? (
                    <SelectItem value="__no_roles__" disabled>
                      {t("common.not_available")}
                    </SelectItem>
                  ) : (
                    roleTypes.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* STATUS */}
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium mb-1">
              {t("common.status")} <span className="text-red-500">*</span>
            </label>

            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(v) => setIsActive(v === "true")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">
                  {t("common.active")}
                </SelectItem>
                <SelectItem value="false">
                  {t("common.inactive")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* BUTTONS */}
          <div className="flex justify-end gap-3 mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? t("common.updating")
                  : t("common.saving")
                : isEdit
                ? t("common.update")
                : t("common.save")}
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => navigate(ENC_LIST_PATH)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
