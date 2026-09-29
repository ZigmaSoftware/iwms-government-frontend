import type { GovernmentRoleOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Select from "@/components/form/Select";
import { getEncryptedRoute } from "@/utils/routeCache";
import { governmentUserTypeApi, staffHierarchyApi } from "@/helpers/admin";
import LocationFields, {
  emptyGeo,
  LOCAL_BODY_LEVELS,
  type GeoLocationValue,
} from "@/pages/admin/modules/masters/shared/LocationHierarchyFields";

const TOP_OF_CHAIN = "__none__";

const toList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
};

const firstError = (value: unknown): string | undefined =>
  Array.isArray(value) ? String(value[0]) : typeof value === "string" ? value : undefined;

const toStr = (value: unknown) => (value === null || value === undefined ? "" : String(value));

// Government level -> the broader levels above it (mirrors LEVEL_ANCESTORS
// in the backend's app/utils/staff_hierarchy.py).
const LEVEL_ANCESTORS: Record<string, string[]> = {
  state: [],
  district: ["state"],
  corporation: ["district", "state"],
  municipality: ["district", "state"],
  town_panchayat: ["district", "state"],
  panchayat_union: ["district", "state"],
  panchayat: ["district", "state"],
};

const LOCAL_BODY_LEVEL_TO_GOV_LEVEL: Record<string, string> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
};

/** Government level the chosen location sits at; null admits every level. */
const scopeLevelOf = (geo: GeoLocationValue): string | null => {
  if (geo.localBodyLevel) return LOCAL_BODY_LEVEL_TO_GOV_LEVEL[geo.localBodyLevel] ?? null;
  if (geo.districtId || geo.areaTypeId) return "district";
  if (geo.stateId) return "state";
  return null;
};

/** A location admits only roles of exactly its level (State -> State roles,
 *  Panchayat -> Panchayat roles); no location admits every role. */
const levelWithin = (level: string | undefined, scopeLevel: string | null) =>
  !scopeLevel || level === scopeLevel;

/** A role reports to its own level, or to District / State. */
const canReportTo = (level: string | undefined, headLevel: string | undefined) =>
  !level || headLevel === level || (LEVEL_ANCESTORS[level] ?? []).includes(headLevel ?? "");

const roleLabel = (role: GovernmentRoleOption) =>
  `${role.name_display ?? role.name}${role.level_display ? ` (${role.level_display})` : ""}`;

export default function StaffHierarchyForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { encRoleManagement, encStaffHierarchy } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encRoleManagement, encStaffHierarchy);

  const [roles, setRoles] = useState<GovernmentRoleOption[]>([]);
  const [roleId, setRoleId] = useState("");
  const [reportsToId, setReportsToId] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [geo, setGeo] = useState<GeoLocationValue>(emptyGeo);

  const [pageReady, setPageReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      governmentUserTypeApi.readAll(),
      isEdit && id ? staffHierarchyApi.read(id) : Promise.resolve(null),
    ])
      .then(([rolesRes, record]: any) => {
        if (cancelled) return;

        setRoles(toList<GovernmentRoleOption>(rolesRes));

        if (record) {
          setRoleId(String(record.governmentusertype_id ?? ""));
          setReportsToId(String(record.reports_to_governmentusertype_id ?? ""));
          setHierarchyLevel(String(record.hierarchy_level ?? "1"));
          setIsActive(Boolean(record.is_active));

          const localBodyLevel =
            LOCAL_BODY_LEVELS.find((item) => toStr(record[item.value]))?.value ?? "";
          setGeo({
            countryId: toStr(record.country_id),
            stateId: toStr(record.state_id),
            districtId: toStr(record.district_id),
            areaTypeId: toStr(record.area_type_id),
            localBodyLevel,
            localBodyId: localBodyLevel ? toStr(record[localBodyLevel]) : "",
          });
        }
      })
      .catch(() => {
        if (!cancelled) notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      })
      .finally(() => {
        if (!cancelled) setPageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopeLevel = scopeLevelOf(geo);
  const selectedRole = roles.find((role) => role.unique_id === roleId);
  // Reports To follows the location's level (State -> State; District ->
  // State, District; local body -> State, District, that local body), or the
  // chosen role's level when no location is picked.
  const reportsToBaseLevel = scopeLevel ?? selectedRole?.level;

  const roleOptions = useMemo(
    () =>
      roles
        .filter(
          (role) =>
            (role.is_active !== false || role.unique_id === roleId) &&
            levelWithin(role.level, scopeLevel),
        )
        .map((role) => ({ value: role.unique_id, label: roleLabel(role) })),
    [roles, roleId, scopeLevel],
  );

  // Changing the location drops a role (and its head) that no longer
  // belongs there, e.g. a District role once a Panchayat is picked.
  const handleGeoChange = (next: GeoLocationValue) => {
    setGeo(next);
    const nextScopeLevel = scopeLevelOf(next);
    if (selectedRole && !levelWithin(selectedRole.level, nextScopeLevel)) {
      setRoleId("");
      setReportsToId("");
      return;
    }
    const head = roles.find((item) => item.unique_id === reportsToId);
    if (head && !canReportTo(nextScopeLevel ?? selectedRole?.level, head.level)) {
      setReportsToId("");
    }
  };

  const handleRoleChange = (value: string) => {
    setRoleId(value);
    const role = roles.find((item) => item.unique_id === value);
    const head = roles.find((item) => item.unique_id === reportsToId);
    if (value === reportsToId || (head && !canReportTo(scopeLevel ?? role?.level, head.level))) {
      setReportsToId("");
    }
  };

  const reportsToOptions = useMemo(
    () => [
      { value: TOP_OF_CHAIN, label: t("admin.staff_hierarchy.top_of_chain") },
      ...roles
        .filter(
          (role) =>
            role.unique_id !== roleId &&
            (role.is_active !== false || role.unique_id === reportsToId) &&
            canReportTo(reportsToBaseLevel, role.level),
        )
        .map((role) => ({ value: role.unique_id, label: roleLabel(role) })),
    ],
    [roles, roleId, reportsToId, reportsToBaseLevel, t],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roleId) {
      notify.fire(t("common.error"), t("common.all_fields_required"), "error");
      return;
    }

    const payload = {
      governmentusertype_id: roleId,
      reports_to_governmentusertype_id: reportsToId || null,
      hierarchy_level: Math.max(Number(hierarchyLevel) || 1, 1),
      is_active: isActive,
      // Blank location = applies everywhere; the narrowest location chosen
      // overrides broader rows for staff in that area.
      country_id: geo.countryId || null,
      state_id: geo.stateId || null,
      district_id: geo.districtId || null,
      area_type_id: geo.areaTypeId || null,
      ...Object.fromEntries(
        LOCAL_BODY_LEVELS.map(({ value }) => [
          value,
          geo.localBodyLevel === value && geo.localBodyId ? geo.localBodyId : null,
        ]),
      ),
    };

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await staffHierarchyApi.update(id as string, payload);
      } else {
        await staffHierarchyApi.create(payload);
      }

      notify.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success",
      );
      navigate(LIST_PATH);
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        firstError(data?.non_field_errors) ??
        firstError(data?.governmentusertype_id) ??
        firstError(data?.reports_to_governmentusertype_id) ??
        firstError(data?.hierarchy_level) ??
        [
          "country_id",
          "state_id",
          "district_id",
          "area_type_id",
          ...LOCAL_BODY_LEVELS.map(({ value }) => value),
        ]
          .map((field) => firstError(data?.[field]))
          .find(Boolean) ??
        (typeof data === "string" ? data : t("common.invalid_data"));
      notify.fire(t("common.error"), message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isEdit
    ? t("common.edit_item", { item: t("admin.nav.staff_hierarchy") })
    : t("common.add_item", { item: t("admin.nav.staff_hierarchy") });

  if (!pageReady) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard title={title}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-sm text-gray-500">{t("admin.staff_hierarchy.help_text")}</p>

        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            {t("admin.staff_hierarchy.location")}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {t("admin.staff_hierarchy.location_help")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LocationFields value={geo} onChange={handleGeoChange} optional />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("admin.staff_hierarchy.role")} <span className="text-red-500">*</span>
            </label>
            <Select
              value={roleId}
              onChange={handleRoleChange}
              options={roleOptions}
              placeholder={t("common.select_item_placeholder", {
                item: t("admin.staff_hierarchy.role"),
              })}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t("admin.staff_hierarchy.reports_to")}
            </label>
            <Select
              value={reportsToId || TOP_OF_CHAIN}
              onChange={(value) => setReportsToId(value === TOP_OF_CHAIN ? "" : value)}
              options={reportsToOptions}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t("admin.staff_hierarchy.level")} <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              value={hierarchyLevel}
              onChange={(e) => setHierarchyLevel(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t("common.status")} <span className="text-red-500">*</span>
            </label>
            <Select
              value={isActive ? "true" : "false"}
              onChange={(value) => setIsActive(value === "true")}
              options={[
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
              ]}
              disabled={isSubmitting}
            />
          </div>
        </div>

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
            onClick={() => navigate(LIST_PATH)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
