import type { DailyTripAssignmentRecord, SelectOption, TripExceptionLogFormState } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { toSwalMessage } from "@/lib/zodErrors";
import { tripExceptionLogSchema } from "@/schemas/masters/transportMasters/tripExceptionLog.schema";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Textarea } from "@/components/ui/textarea";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const exceptionTypeValues = [
  "GPS_MISMATCH",
  "MISSED_ATTENDANCE",
  "OVER_CAPACITY",
  "ROUTE_DEVIATION",
  "VEHICLE_UNAVAILABLE",
] as const;

const detectedByValues = ["SYSTEM", "SUPERVISOR"] as const;

const toOptions = (items: any[], valueKey: string, labelKey: string, fallbackKey?: string): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: String(item?.[labelKey] ?? item?.[fallbackKey ?? ""] ?? item?.[valueKey] ?? ""),
    }))
    .filter((option) => option.value);

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

export default function TripExceptionLogForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);

  const tripExceptionLogApi = adminApi.tripExceptionLogs;
  const dailyTripAssignmentApi = adminApi.dailyTripAssignment;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [dailyTripAssignmentRecords, setDailyTripAssignmentRecords] = useState<DailyTripAssignmentRecord[]>([]);

  const [formData, setFormData] = useState<TripExceptionLogFormState>({
    daily_trip_assignment_id: "",
    exception_type: "",
    remarks: "",
    detected_by: "SYSTEM",
  });

  const { encTransportMaster, encTripExceptionLog } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encTripExceptionLog);
  const stateRecord = (location.state as { record?: Partial<TripExceptionLogFormState> } | null)?.record;

  const exceptionTypeOptions: SelectOption[] = useMemo(
    () =>
      exceptionTypeValues.map((value) => ({
        value,
        label: t(`admin.trip_exception_log.exception_types.${value.toLowerCase()}`),
      })),
    [t]
  );

  const detectedByOptions: SelectOption[] = useMemo(
    () =>
      detectedByValues.map((value) => ({
        value,
        label: t(`admin.trip_exception_log.detected_by_options.${value.toLowerCase()}`),
      })),
    [t]
  );

  useEffect(() => {
    setFetching(true);
    dailyTripAssignmentApi
      .readAll()
      .then((res) => {
        setDailyTripAssignmentRecords(normalizeList(res));
      })
      .catch((error) => {
        const message = extractErrorMessage(error) ?? t("common.load_failed");
        Swal.fire(t("common.error"), message, "error");
      })
      .finally(() => setFetching(false));
  }, [t, dailyTripAssignmentApi]);

  useEffect(() => {
    if (!isEdit || !stateRecord) return;
    setFormData({
      daily_trip_assignment_id: stateRecord?.daily_trip_assignment_id ?? "",
      exception_type: stateRecord?.exception_type ?? "",
      remarks: stateRecord?.remarks ?? "",
      detected_by: stateRecord?.detected_by ?? "SYSTEM",
    });
  }, [isEdit, stateRecord]);

  useEffect(() => {
    if (!isEdit || !id) return;

    tripExceptionLogApi.read(id)
      .then((res: any) => {
        setFormData({
          daily_trip_assignment_id: res?.daily_trip_assignment_id ?? "",
          exception_type: res?.exception_type ?? "",
          remarks: res?.remarks ?? "",
          detected_by: res?.detected_by ?? "SYSTEM",
        });
      })
      .catch((error) => {
        const message = extractErrorMessage(error) ?? t("common.load_failed");
        Swal.fire(t("common.error"), message, "error");
      });
  }, [id, isEdit, t, tripExceptionLogApi]);

  const tripOptions = useMemo(() => {
    const list = isEdit
      ? dailyTripAssignmentRecords
      : dailyTripAssignmentRecords.filter((trip) =>
          trip?.status ? !["Completed", "Cancelled"].includes(trip.status) : true
        );
    return toOptions(list, "unique_id", "trip_no", "unique_id");
  }, [isEdit, dailyTripAssignmentRecords]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isEdit) {
      Swal.fire(t("common.warning"), t("admin.trip_exception_log.edit_not_allowed"), "warning");
      return;
    }

    const validation = tripExceptionLogSchema.safeParse({
      daily_trip_assignment_id: formData.daily_trip_assignment_id,
      exception_type: formData.exception_type,
      remarks: formData.remarks || null,
      detected_by: formData.detected_by,
    });
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        daily_trip_assignment_id: validation.data.daily_trip_assignment_id,
        exception_type: validation.data.exception_type,
        remarks: validation.data.remarks || null,
        detected_by: validation.data.detected_by,
      };

      await tripExceptionLogApi.create(payload);

      Swal.fire(t("common.success"), t("common.added_success"), "success");
      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      const message = extractErrorMessage(error) ?? t("common.save_failed_desc");
      Swal.fire(t("common.save_failed"), message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.trip_exception_log.title_edit")
            : t("admin.trip_exception_log.title_add")
        }
        desc={t("admin.trip_exception_log.subtitle")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>{t("admin.trip_exception_log.daily_trip_assignment")}</Label>
              <Select
                value={formData.daily_trip_assignment_id}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, daily_trip_assignment_id: value }))
                }
                options={tripOptions}
                placeholder={t("common.select_option")}
                disabled={fetching || isEdit}
                required
              />
            </div>

            <div>
              <Label>{t("admin.trip_exception_log.exception_type")}</Label>
              <Select
                value={formData.exception_type}
                onChange={(value) => setFormData((prev) => ({ ...prev, exception_type: value }))}
                options={exceptionTypeOptions}
                placeholder={t("common.select_option")}
                disabled={fetching || isEdit}
                required
              />
            </div>

            <div>
              <Label>{t("admin.trip_exception_log.detected_by")}</Label>
              <Select
                value={formData.detected_by}
                onChange={(value) => setFormData((prev) => ({ ...prev, detected_by: value }))}
                options={detectedByOptions}
                placeholder={t("common.select_option")}
                disabled={fetching || isEdit}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label>{t("admin.trip_exception_log.remarks")}</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder={t("admin.trip_exception_log.remarks")}
                rows={3}
                disabled={isEdit}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={loading || fetching}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? t("common.saving") : t("common.save")}
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
