import type { DailyTripAssignmentRecord } from "./types";
import type { SelectOption, VehicleTripAuditEditorProps, VehicleTripAuditFormState, VehicleTripAuditPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { toSwalMessage } from "@/lib/zodErrors";
import { vehicleTripAuditSchema } from "@/schemas/masters/transportMasters/vehicleTripAudit.schema";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const toOptions = (
  items: any[],
  valueKey: string,
  labelKey: string,
  fallbackKey?: string
): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: String(
        item?.[labelKey] ?? item?.[fallbackKey ?? ""] ?? item?.[valueKey] ?? ""
      ),
    }))
    .filter((option) => option.value);

const toDateTimeLocal = (value?: string | null) =>
  value ? String(value).slice(0, 16) : "";

const formatGpsArray = (value: any): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const parseGpsArray = (value: string): number[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  let parsed: any;
  if (trimmed.startsWith("[")) {
    parsed = JSON.parse(trimmed);
  } else {
    parsed = trimmed.split(",").map((item) => item.trim());
  }

  if (!Array.isArray(parsed)) {
    throw new Error("GPS array must be a list");
  }

  const numbers = parsed.map((item) => Number(item));
  if (numbers.some((item) => !Number.isFinite(item))) {
    throw new Error("GPS array must be numeric values");
  }

  return numbers;
};

const extractErrorMessage = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string") return data.error;
  if (typeof data === "object") {
    const firstValue = Object.values(data)[0];
    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (typeof firstValue === "string") return firstValue;
  }
  return null;
};

function VehicleTripAuditEditor({
  formData,
  tripOptions,
  vehicles,
  fetching,
  isEdit,
  isSubmitting,
  isVehicleLocked,
  onChange,
  onCancel,
  onSubmit,
}: VehicleTripAuditEditorProps) {
  const { t } = useTranslation();

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <Label>{t("admin.vehicle_trip_audit.daily_trip_assignment")}</Label>
          <Select
            value={formData.daily_trip_assignment_id}
            onChange={(value) => onChange({ daily_trip_assignment_id: value })}
            options={tripOptions}
            placeholder={t("common.select_option")}
            disabled={fetching || isEdit}
            required
          />
        </div>

        <div>
          <Label>{t("admin.vehicle_trip_audit.vehicle")}</Label>
          <Select
            value={formData.vehicle_id}
            onChange={(value) => onChange({ vehicle_id: value })}
            options={vehicles}
            placeholder={t("common.select_option")}
            disabled={fetching || isVehicleLocked}
            required
          />
        </div>

        <div className="md:col-span-2">
          <Label>{t("admin.vehicle_trip_audit.gps_lat")}</Label>
          <Textarea
            value={formData.gps_lat}
            onChange={(e) => onChange({ gps_lat: e.target.value })}
            placeholder={t("admin.vehicle_trip_audit.gps_placeholder")}
            rows={3}
          />
        </div>

        <div className="md:col-span-2">
          <Label>{t("admin.vehicle_trip_audit.gps_lon")}</Label>
          <Textarea
            value={formData.gps_lon}
            onChange={(e) => onChange({ gps_lon: e.target.value })}
            placeholder={t("admin.vehicle_trip_audit.gps_placeholder")}
            rows={3}
          />
        </div>

        <div>
          <Label>{t("admin.vehicle_trip_audit.avg_speed")}</Label>
          <Input
            type="number"
            value={formData.avg_speed}
            onChange={(e) => onChange({ avg_speed: e.target.value })}
            placeholder={t("admin.vehicle_trip_audit.avg_speed")}
          />
        </div>

        <div>
          <Label>{t("admin.vehicle_trip_audit.idle_seconds")}</Label>
          <Input value={formData.idle_seconds} disabled className="bg-gray-100" />
        </div>

        <div>
          <Label>{t("admin.vehicle_trip_audit.captured_at")}</Label>
          <Input
            type="datetime-local"
            value={toDateTimeLocal(formData.captured_at)}
            disabled
            className="bg-gray-100"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting || fetching}
          className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting
            ? t("common.saving")
            : isEdit
              ? t("common.update")
              : t("common.save")}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

const emptyFormState: VehicleTripAuditFormState = {
  daily_trip_assignment_id: "",
  vehicle_id: "",
  gps_lat: "",
  gps_lon: "",
  avg_speed: "",
  idle_seconds: "",
  captured_at: "",
};

export default function VehicleTripAuditForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);

  const stateRecord = (
    location.state as { record?: Partial<VehicleTripAuditFormState> } | null
  )?.record;

  const [dailyTripAssignmentRecords, setDailyTripAssignmentRecords] = useState<DailyTripAssignmentRecord[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<SelectOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<VehicleTripAuditFormState>(() => ({
    ...emptyFormState,
    daily_trip_assignment_id: stateRecord?.daily_trip_assignment_id ?? "",
    vehicle_id: stateRecord?.vehicle_id ?? "",
    gps_lat: formatGpsArray(stateRecord?.gps_lat),
    gps_lon: formatGpsArray(stateRecord?.gps_lon),
    avg_speed: stateRecord?.avg_speed != null ? String(stateRecord.avg_speed) : "",
    idle_seconds: stateRecord?.idle_seconds != null ? String(stateRecord.idle_seconds) : "",
    captured_at: stateRecord?.captured_at ?? "",
  }));

  const { encTransportMaster, encVehicleTripAudit } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encVehicleTripAudit);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);

    Promise.all([
      adminApi.dailyTripAssignment.readAll(),
      adminApi.vehicleCreations.readAll(),
    ])
      .then(([tripData, vehicleData]) => {
        if (cancelled) return;
        setDailyTripAssignmentRecords(normalizeList(tripData) as DailyTripAssignmentRecord[]);
        setVehicleOptions(toOptions(normalizeList(vehicleData), "unique_id", "vehicle_no"));
        setFetching(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setFetching(false);
        Swal.fire(
          t("common.error"),
          extractErrorMessage(error) ?? t("common.load_failed"),
          "error"
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;

    adminApi.vehicleTripAudits.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setFormData({
          daily_trip_assignment_id: res.daily_trip_assignment_id ?? "",
          vehicle_id: res.vehicle_id ?? "",
          gps_lat: formatGpsArray(res.gps_lat),
          gps_lon: formatGpsArray(res.gps_lon),
          avg_speed: res.avg_speed != null ? String(res.avg_speed) : "",
          idle_seconds: res.idle_seconds != null ? String(res.idle_seconds) : "",
          captured_at: res.captured_at ?? "",
        });
      })
      .catch((error: any) => {
        if (cancelled) return;
        Swal.fire(
          t("common.error"),
          extractErrorMessage(error) ?? t("common.load_failed"),
          "error"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const dailyTripAssignmentMeta = useMemo(
    () =>
      dailyTripAssignmentRecords.reduce<Record<string, { vehicle_id?: string; status?: string }>>(
        (acc, trip) => {
          if (trip?.unique_id) {
            acc[String(trip.unique_id)] = {
              vehicle_id: trip.vehicle_id ?? undefined,
              status: trip.status ?? undefined,
            };
          }
          return acc;
        },
        {}
      ),
    [dailyTripAssignmentRecords]
  );

  const tripOptions = useMemo(() => {
    const list = isEdit
      ? dailyTripAssignmentRecords
      : dailyTripAssignmentRecords.filter((trip) => trip.status === "In Progress");
    return toOptions(list, "unique_id", "trip_no", "unique_id");
  }, [isEdit, dailyTripAssignmentRecords]);

  useEffect(() => {
    if (isEdit) return;

    const tripMeta = dailyTripAssignmentMeta[formData.daily_trip_assignment_id];
    if (!tripMeta?.vehicle_id) return;

    setFormData((prev) =>
      prev.vehicle_id === tripMeta.vehicle_id
        ? prev
        : { ...prev, vehicle_id: tripMeta.vehicle_id ?? "" }
    );
  }, [formData.daily_trip_assignment_id, isEdit, dailyTripAssignmentMeta]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validation = vehicleTripAuditSchema.safeParse(formData);
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    let latValues: number[];
    let lonValues: number[];
    try {
      latValues = parseGpsArray(validation.data.gps_lat);
      lonValues = parseGpsArray(validation.data.gps_lon);
    } catch (error: unknown) {
      Swal.fire(
        t("common.warning"),
        String(error instanceof Error ? error.message : t("common.invalid_data")),
        "warning"
      );
      return;
    }

    if (
      !latValues.length ||
      !lonValues.length ||
      latValues.length !== lonValues.length
    ) {
      Swal.fire(t("common.warning"), t("common.invalid_data"), "warning");
      return;
    }

    const avgSpeed = Number(validation.data.avg_speed);
    if (!Number.isFinite(avgSpeed)) {
      Swal.fire(t("common.warning"), t("common.invalid_data"), "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const payload: VehicleTripAuditPayload = {
          gps_lat: latValues,
          gps_lon: lonValues,
          avg_speed: avgSpeed,
        };
        await adminApi.vehicleTripAudits.update(id, payload);
      } else {
        const payload: VehicleTripAuditPayload = {
          daily_trip_assignment_id: validation.data.daily_trip_assignment_id,
          vehicle_id: validation.data.vehicle_id,
          gps_lat: latValues,
          gps_lon: lonValues,
          avg_speed: avgSpeed,
        };
        await adminApi.vehicleTripAudits.create(payload);
      }

      Swal.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success"
      );
      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      const message = extractErrorMessage(error) ?? t("common.save_failed_desc");
      Swal.fire(t("common.save_failed"), message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tripMeta = formData.daily_trip_assignment_id
    ? dailyTripAssignmentMeta[formData.daily_trip_assignment_id]
    : undefined;
  const isVehicleLocked = Boolean(
    isEdit || (tripMeta?.vehicle_id && formData.daily_trip_assignment_id)
  );

  const formKey = isEdit ? String(id) : "new-vehicle-trip-audit";

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.vehicle_trip_audit.title_edit")
            : t("admin.vehicle_trip_audit.title_add")
        }
        desc={t("admin.vehicle_trip_audit.subtitle")}
      >
        <VehicleTripAuditEditor
          key={formKey}
          formData={formData}
          tripOptions={tripOptions}
          vehicles={vehicleOptions}
          fetching={fetching}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          isVehicleLocked={isVehicleLocked}
          onChange={(updates) =>
            setFormData((prev) => ({
              ...prev,
              ...updates,
            }))
          }
          onCancel={() => navigate(ENC_LIST_PATH)}
          onSubmit={handleSubmit}
        />
      </ComponentCard>
    </div>
  );
}
