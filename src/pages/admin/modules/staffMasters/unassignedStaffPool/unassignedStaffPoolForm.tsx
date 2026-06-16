import type { SelectOption, UnassignedStaffPoolFormState, UserLocationMeta } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";


const UNASSIGNED_STAFF_POOL_FIELDS: Record<string, string[]> = {
  role: ["role"],
  operator_id: ["operator_id", "operator"],
  driver_id: ["driver_id", "driver"],
  zone_id: ["zone_id", "zone"],
  ward_id: ["ward_id", "ward"],
  status: ["status"],
  daily_trip_assignment_id: ["daily_trip_assignment_id", "daily_trip_assignment"],
};

const statusOptions: SelectOption[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "ASSIGNED", label: "Assigned" },
];

const roleOptions: SelectOption[] = [
  { value: "operator", label: "Operator" },
  { value: "driver", label: "Driver" },
];

const toOptions = (items: any[], valueKey: string, labelKey: string, fallbackKey?: string): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: String(item?.[labelKey] ?? item?.[fallbackKey ?? ""] ?? item?.[valueKey] ?? ""),
    }))
    .filter((option) => option.value);

export default function UnassignedStaffPoolForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "staff-masters",
    "unassigned-staff-pool",
    UNASSIGNED_STAFF_POOL_FIELDS
  );

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [operators, setOperators] = useState<SelectOption[]>([]);
  const [drivers, setDrivers] = useState<SelectOption[]>([]);
  const [zones, setZones] = useState<SelectOption[]>([]);
  const [wardRecords, setWardRecords] = useState<any[]>([]);
  const [dailyTripAssignments, setDailyTripAssignments] = useState<SelectOption[]>([]);
  const [userMeta, setUserMeta] = useState<Record<string, UserLocationMeta>>({});

  const [role, setRole] = useState<string>("");

  const [formData, setFormData] = useState<UnassignedStaffPoolFormState>({
    operator_id: "",
    driver_id: "",
    zone_id: "",
    ward_id: "",
    status: "AVAILABLE",
    daily_trip_assignment_id: "",
  });

  const { encStaffMasters, encUnassignedStaffPool } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encStaffMasters, encUnassignedStaffPool);
  const stateRecord = (location.state as { record?: Partial<UnassignedStaffPoolFormState> } | null)?.record;

  useEffect(() => {
    let cancelled = false;
    setFetching(true);

    Promise.all([
      adminApi.usersCreation.readAll() as Promise<any>,
      adminApi.zones.readAll() as Promise<any>,
      adminApi.wards.readAll() as Promise<any>,
      adminApi.dailyTripAssignment.readAll() as Promise<any>,
    ])
      .then(([usersData, zonesData, wardsData, dailyTripAssignmentsData]: [any, any, any, any]) => {
        if (cancelled) return;
        try {
          const users = normalizeList(usersData);
          const operatorUsers = users.filter(
            (user: any) => String(user?.staffusertype_name ?? "").toLowerCase() === "operator"
          );
          const driverUsers = users.filter(
            (user: any) => String(user?.staffusertype_name ?? "").toLowerCase() === "driver"
          );

          setOperators(toOptions(operatorUsers, "unique_id", "staff_name", "unique_id"));
          setDrivers(toOptions(driverUsers, "unique_id", "staff_name", "unique_id"));
          setZones(toOptions(normalizeList(zonesData), "unique_id", "name"));
          setWardRecords(normalizeList(wardsData));
          setDailyTripAssignments(toOptions(normalizeList(dailyTripAssignmentsData), "unique_id", "trip_no"));
          setUserMeta(
            users.reduce<Record<string, UserLocationMeta>>((acc, user: any) => {
              const uid = user?.unique_id;
              if (!uid) return acc;
              acc[String(uid)] = {
                zone_id: user?.zone_id ?? undefined,
                ward_id: user?.ward_id ?? undefined,
              };
              return acc;
            }, {})
          );
        } catch {
          // ignore normalisation errors
        } finally {
          setFetching(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFetching(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit || !stateRecord) return;

    const operatorId = stateRecord?.operator_id ?? "";
    const driverId = stateRecord?.driver_id ?? "";

    setFormData({
      operator_id: operatorId,
      driver_id: driverId,
      zone_id: stateRecord?.zone_id ?? "",
      ward_id: stateRecord?.ward_id ?? "",
      status: stateRecord?.status ?? "AVAILABLE",
      daily_trip_assignment_id: stateRecord?.daily_trip_assignment_id ?? "",
    });

    if (operatorId) {
      setRole("operator");
    } else if (driverId) {
      setRole("driver");
    }
  }, [isEdit, stateRecord]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;

    adminApi.unassignedStaffPool.read(id)
      .then((res: any) => {
        if (cancelled) return;
        const operatorId = res?.operator_id ?? "";
        const driverId = res?.driver_id ?? "";

        setFormData({
          operator_id: operatorId,
          driver_id: driverId,
          zone_id: res?.zone_id ?? "",
          ward_id: res?.ward_id ?? "",
          status: res?.status ?? "AVAILABLE",
          daily_trip_assignment_id: res?.daily_trip_assignment_id ?? "",
        });

        if (operatorId) {
          setRole("operator");
        } else if (driverId) {
          setRole("driver");
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(t("common.error"), String(err?.response?.data ?? err?.message ?? t("common.load_failed")), "error");
      });

    return () => { cancelled = true; };
  }, [id, isEdit, t]);

  const wardOptions = useMemo(() => {
    const filtered = formData.zone_id
      ? wardRecords.filter((ward) => String(ward?.zone_id ?? "") === String(formData.zone_id))
      : wardRecords;
    return toOptions(filtered, "unique_id", "name");
  }, [formData.zone_id, wardRecords]);

  const handleRoleChange = (value: string) => {
    setRole(value);
    if (value === "operator") {
      setFormData((prev) => ({ ...prev, driver_id: "" }));
    } else if (value === "driver") {
      setFormData((prev) => ({ ...prev, operator_id: "" }));
    }
  };

  const applyStaffLocation = (staffId: string) => {
    const meta = userMeta[staffId];
    if (!meta) return;

    setFormData((prev) => {
      const nextZone = meta.zone_id ?? prev.zone_id;
      const zoneChanged = meta.zone_id && meta.zone_id !== prev.zone_id;
      const nextWard = meta.ward_id ?? (zoneChanged ? "" : prev.ward_id);

      return {
        ...prev,
        zone_id: nextZone,
        ward_id: nextWard,
      };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const selectedId = role === "operator" ? formData.operator_id : formData.driver_id;

    if (
      (showField("role") && !role) ||
      ((role === "operator" || showField("operator_id")) && role === "operator" && !selectedId) ||
      ((role === "driver" || showField("driver_id")) && role === "driver" && !selectedId) ||
      (showField("zone_id") && !formData.zone_id) ||
      (showField("ward_id") && !formData.ward_id) ||
      (showField("status") && !formData.status)
    ) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }

    setLoading(true);
    try {
      const rawPayload = {
        operator_id: role === "operator" ? formData.operator_id : null,
        driver_id: role === "driver" ? formData.driver_id : null,
        zone_id: formData.zone_id,
        ward_id: formData.ward_id,
        status: formData.status,
        daily_trip_assignment_id: formData.daily_trip_assignment_id || null,
      };
      const payload = filterPayload(rawPayload);

      if (isEdit && id) {
        await adminApi.unassignedStaffPool.update(id, payload);
      } else {
        await adminApi.unassignedStaffPool.create(payload);
      }

      Swal.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success"
      );
      navigate(ENC_LIST_PATH);
    } catch {
      Swal.fire(t("common.save_failed"), t("common.save_failed_desc"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.unassigned_staff_pool.title_edit")
            : t("admin.unassigned_staff_pool.title_add")
        }
        desc={t("admin.unassigned_staff_pool.subtitle")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {showField("role") && (
            <div>
              <Label>{t("admin.unassigned_staff_pool.role")}</Label>
              <Select
                value={role}
                onChange={handleRoleChange}
                options={roleOptions}
                placeholder={t("admin.unassigned_staff_pool.role_placeholder")}
                disabled={fetching}
                required
              />
            </div>
            )}

            {role === "operator" && showField("operator_id") && (
              <div>
                <Label>{t("admin.unassigned_staff_pool.operator")}</Label>
                <Select
                  value={formData.operator_id}
                  onChange={(value) => {
                    setFormData((prev) => ({ ...prev, operator_id: value }));
                    applyStaffLocation(value);
                  }}
                  options={operators}
                  placeholder={t("common.select_option")}
                  disabled={fetching}
                  required
                />
              </div>
            )}

            {role === "driver" && showField("driver_id") && (
              <div>
                <Label>{t("admin.unassigned_staff_pool.driver")}</Label>
                <Select
                  value={formData.driver_id}
                  onChange={(value) => {
                    setFormData((prev) => ({ ...prev, driver_id: value }));
                    applyStaffLocation(value);
                  }}
                  options={drivers}
                  placeholder={t("common.select_option")}
                  disabled={fetching}
                  required
                />
              </div>
            )}

            {showField("zone_id") && (
            <div>
              <Label>{t("admin.unassigned_staff_pool.zone")}</Label>
              <Select
                value={formData.zone_id}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, zone_id: value, ward_id: "" }))
                }
                options={zones}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>
            )}

            {showField("ward_id") && (
            <div>
              <Label>{t("admin.unassigned_staff_pool.ward")}</Label>
              <Select
                value={formData.ward_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, ward_id: value }))}
                options={wardOptions}
                placeholder={t("common.select_option")}
                disabled={fetching || !formData.zone_id}
                required
              />
            </div>
            )}

            {showField("status") && (
            <div>
              <Label>{t("admin.unassigned_staff_pool.status")}</Label>
              <Select
                value={formData.status}
                onChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                options={statusOptions}
                placeholder={t("common.select_status")}
                disabled={fetching}
              />
            </div>
            )}

            {showField("daily_trip_assignment_id") && (
            <div>
              <Label>{t("admin.unassigned_staff_pool.daily_trip_assignment")}</Label>
              <Select
                value={formData.daily_trip_assignment_id}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, daily_trip_assignment_id: value }))
                }
                options={dailyTripAssignments}
                placeholder={t("common.select_option")}
                disabled={fetching}
              />
            </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={loading || fetching}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>

            <button
              type="button"
              onClick={() => navigate(ENC_LIST_PATH)}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
