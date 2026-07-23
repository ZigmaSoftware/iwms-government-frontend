import type { DailyTripAssignmentRecord, SelectOption, StaffTemplateRecord, TripAttendanceFormState } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { api } from "@/api";
import { normalizeList } from "@/utils/forms";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { toSwalMessage } from "@/lib/zodErrors";
import { tripAttendanceSchema } from "@/schemas/masters/transportMasters/tripAttendance.schema";


const sourceOptions: SelectOption[] = [
  { value: "MOBILE", label: "Mobile" },
  { value: "VEHICLE_CAM", label: "Vehicle Camera" },
];

const TRIP_ATTENDANCE_FIELDS: Record<string, string[]> = {
  daily_trip_assignment_id: ["daily_trip_assignment_id", "daily_trip_assignment"],
  staff_id: ["staff_id", "staff"],
  vehicle_id: ["vehicle_id", "vehicle"],
  attendance_time: ["attendance_time"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  source: ["source"],
  photo: ["photo"],
};

const toOptions = (items: any[], valueKey: string, labelKey: string, fallbackKey?: string): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: String(item?.[labelKey] ?? item?.[fallbackKey ?? ""] ?? item?.[valueKey] ?? ""),
    }))
    .filter((option) => option.value);

const toDateTimeLocal = (value?: string | null) => (value ? String(value).slice(0, 16) : "");

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

export default function TripAttendanceForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "transport-master",
    "trip-attendance",
    TRIP_ATTENDANCE_FIELDS
  );

  const tripAttendanceApi = adminApi.tripAttendances;
  const dailyTripAssignmentApi = adminApi.dailyTripAssignment;
  const staffTemplateApi = adminApi.staffTemplateCreation;
  const userApi = adminApi.usersCreation;
  const vehicleApi = adminApi.vehicleCreations;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [dailyTripAssignmentRecords, setDailyTripAssignmentRecords] = useState<DailyTripAssignmentRecord[]>([]);
  const [vehicles, setVehicles] = useState<SelectOption[]>([]);
  const [staffRecords, setStaffRecords] = useState<any[]>([]);
  const [staffTemplates, setStaffTemplates] = useState<Record<string, StaffTemplateRecord>>({});
  const [dailyTripAssignmentMeta, setDailyTripAssignmentMeta] = useState<
    Record<string, { vehicle_id?: string; staff_template_id?: string; status?: string }>
  >({});

  // Pending IDs — set when the record loads; applied once options are available
  const [pendingDailyTripAssignmentId, setPendingDailyTripAssignmentId] = useState<string | null>(null);
  const [pendingStaffId, setPendingStaffId] = useState<string | null>(null);
  const [pendingVehicleId, setPendingVehicleId] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<TripAttendanceFormState>({
    daily_trip_assignment_id: "",
    staff_id: "",
    vehicle_id: "",
    attendance_time: "",
    latitude: "",
    longitude: "",
    source: "",
  });

  const { encTransportMaster, encTripAttendance } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encTripAttendance);
  const stateRecord = (location.state as { record?: Partial<TripAttendanceFormState> & { photo?: string } } | null)
    ?.record;

  const backendOrigin = useMemo(
    () => api.defaults.baseURL?.replace(/\/api\/desktop\/?$/, "") || "",
    []
  );

  useEffect(() => {
    setFetching(true);
    Promise.all([
      dailyTripAssignmentApi.readAll(),
      staffTemplateApi.readAll(),
      userApi.readAll(),
      vehicleApi.readAll(),
    ])
      .then(([tripRes, staffRes, userRes, vehicleRes]) => {
        const trips = normalizeList(tripRes) as DailyTripAssignmentRecord[];
        const templates = normalizeList(staffRes) as StaffTemplateRecord[];

        setDailyTripAssignmentRecords(trips);
        setVehicles(toOptions(normalizeList(vehicleRes), "unique_id", "vehicle_no"));
        setStaffRecords(normalizeList(userRes));
        setStaffTemplates(
          templates.reduce<Record<string, StaffTemplateRecord>>((acc, template) => {
            if (template?.unique_id) {
              acc[String(template.unique_id)] = template;
            }
            return acc;
          }, {})
        );
        setDailyTripAssignmentMeta(
          trips.reduce<Record<string, { vehicle_id?: string; staff_template_id?: string; status?: string }>>(
            (acc, trip) => {
              if (trip?.unique_id) {
                acc[String(trip.unique_id)] = {
                  vehicle_id: trip.vehicle_id ?? undefined,
                  staff_template_id: trip.staff_template_id ?? undefined,
                  status: trip.status ?? undefined,
                };
              }
              return acc;
            },
            {}
          )
        );
      })
      .catch((error) => {
        const message = extractErrorMessage(error) ?? t("common.load_failed");
        Swal.fire(t("common.error"), message, "error");
      })
      .finally(() => setFetching(false));
  }, [staffTemplateApi, t, dailyTripAssignmentApi, userApi, vehicleApi]);

  useEffect(() => {
    if (!isEdit || !stateRecord) return;

    const tripInstId = stateRecord?.daily_trip_assignment_id ?? "";
    const staffId = stateRecord?.staff_id ?? "";
    const vehicleId = stateRecord?.vehicle_id ?? "";

    setPendingDailyTripAssignmentId(tripInstId);
    setPendingStaffId(staffId);
    setPendingVehicleId(vehicleId);

    setFormData({
      daily_trip_assignment_id: tripInstId,
      staff_id: staffId,
      vehicle_id: vehicleId,
      attendance_time: stateRecord?.attendance_time ?? "",
      latitude: stateRecord?.latitude ? String(stateRecord.latitude) : "",
      longitude: stateRecord?.longitude ? String(stateRecord.longitude) : "",
      source: stateRecord?.source ?? "",
    });

    const photoValue = (stateRecord as { photo?: string })?.photo;
    if (photoValue) {
      setPhotoPreview(photoValue.startsWith("http") ? photoValue : `${backendOrigin}${photoValue}`);
    }
  }, [backendOrigin, isEdit, stateRecord]);

  useEffect(() => {
    if (!isEdit || !id) return;

    tripAttendanceApi.read(id)
      .then((res: any) => {
        const tripInstId = res?.daily_trip_assignment_id ?? "";
        const staffId = res?.staff_id ?? "";
        const vehicleId = res?.vehicle_id ?? "";

        setPendingDailyTripAssignmentId(tripInstId);
        setPendingStaffId(staffId);
        setPendingVehicleId(vehicleId);

        setFormData({
          daily_trip_assignment_id: tripInstId,
          staff_id: staffId,
          vehicle_id: vehicleId,
          attendance_time: res?.attendance_time ?? "",
          latitude: res?.latitude !== undefined && res?.latitude !== null ? String(res.latitude) : "",
          longitude: res?.longitude !== undefined && res?.longitude !== null ? String(res.longitude) : "",
          source: res?.source ?? "",
        });

        if (res?.photo) {
          setPhotoPreview(res.photo.startsWith("http") ? res.photo : `${backendOrigin}${res.photo}`);
        }
      })
      .catch((error) => {
        const message = extractErrorMessage(error) ?? t("common.load_failed");
        Swal.fire(t("common.error"), message, "error");
      });
  }, [backendOrigin, id, isEdit, t, tripAttendanceApi]);

  useEffect(() => {
    if (!photoFile) return;
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const tripOptions = useMemo(() => {
    const list = isEdit
      ? dailyTripAssignmentRecords
      : dailyTripAssignmentRecords.filter((trip) => trip.status === "In Progress");
    return toOptions(list, "unique_id", "trip_no", "unique_id");
  }, [isEdit, dailyTripAssignmentRecords]);

  const staffOptions = useMemo(() => {
    const staffByRole = staffRecords.filter((staff) => {
      const role = String(staff?.staffusertype_name ?? "").toLowerCase();
      return role === "operator" || role === "driver";
    });

    if (!formData.daily_trip_assignment_id) {
      return toOptions(staffByRole, "unique_id", "staff_name", "unique_id");
    }

    const tripMeta = dailyTripAssignmentMeta[formData.daily_trip_assignment_id];
    const template = tripMeta?.staff_template_id ? staffTemplates[tripMeta.staff_template_id] : undefined;
    const allowedIds = [template?.operator_id, template?.driver_id].filter(Boolean) as string[];

    if (!allowedIds.length) {
      return toOptions(staffByRole, "unique_id", "staff_name", "unique_id");
    }

    return toOptions(
      staffByRole.filter((staff) => allowedIds.includes(String(staff?.unique_id ?? ""))),
      "unique_id",
      "staff_name",
      "unique_id"
    );
  }, [formData.daily_trip_assignment_id, staffRecords, staffTemplates, dailyTripAssignmentMeta]);

  // Apply pending IDs once the corresponding options array is populated
  useEffect(() => {
    if (pendingDailyTripAssignmentId && tripOptions.length > 0 && tripOptions.some((o) => o.value === pendingDailyTripAssignmentId)) {
      setFormData((prev) => ({ ...prev, daily_trip_assignment_id: pendingDailyTripAssignmentId }));
      setPendingDailyTripAssignmentId(null);
    }
  }, [pendingDailyTripAssignmentId, tripOptions]);

  useEffect(() => {
    if (pendingStaffId && staffOptions.length > 0 && staffOptions.some((o) => o.value === pendingStaffId)) {
      setFormData((prev) => ({ ...prev, staff_id: pendingStaffId }));
      setPendingStaffId(null);
    }
  }, [pendingStaffId, staffOptions]);

  useEffect(() => {
    if (pendingVehicleId && vehicles.length > 0 && vehicles.some((o) => o.value === pendingVehicleId)) {
      setFormData((prev) => ({ ...prev, vehicle_id: pendingVehicleId }));
      setPendingVehicleId(null);
    }
  }, [pendingVehicleId, vehicles]);

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

  useEffect(() => {
    if (!formData.daily_trip_assignment_id || !formData.staff_id) return;
    const tripMeta = dailyTripAssignmentMeta[formData.daily_trip_assignment_id];
    const template = tripMeta?.staff_template_id ? staffTemplates[tripMeta.staff_template_id] : undefined;
    const allowedIds = [template?.operator_id, template?.driver_id].filter(Boolean) as string[];

    if (allowedIds.length && !allowedIds.includes(formData.staff_id)) {
      setFormData((prev) => ({ ...prev, staff_id: "" }));
    }
  }, [formData.staff_id, formData.daily_trip_assignment_id, staffTemplates, dailyTripAssignmentMeta]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validation = tripAttendanceSchema(isEdit, showField).safeParse(formData);
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    const latitude = showField("latitude") ? Number(validation.data.latitude) : null;
    const longitude = showField("longitude") ? Number(validation.data.longitude) : null;

    if (
      (showField("latitude") && !Number.isFinite(latitude)) ||
      (showField("longitude") && !Number.isFinite(longitude))
    ) {
      Swal.fire(t("common.warning"), t("common.invalid_data"), "warning");
      return;
    }

    setLoading(true);
    try {
      const multipartConfig = {
        headers: { "Content-Type": "multipart/form-data" },
      };

      if (isEdit && id) {
        const updateBody = new FormData();
        const updatePayload = filterPayload({
          latitude,
          longitude,
          source: validation.data.source,
        });
        Object.entries(updatePayload).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            updateBody.append(key, String(value));
          }
        });
        if (showField("photo") && photoFile) {
          updateBody.append("photo", photoFile);
        }

        await tripAttendanceApi.update(id, updateBody, multipartConfig);
      } else {
        const createBody = new FormData();
        const createPayload = filterPayload({
          daily_trip_assignment_id: formData.daily_trip_assignment_id,
          staff_id: formData.staff_id,
          vehicle_id: formData.vehicle_id,
          latitude,
          longitude,
          source: validation.data.source,
        });
        Object.entries(createPayload).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            createBody.append(key, String(value));
          }
        });
        if (showField("photo") && photoFile) {
          createBody.append("photo", photoFile);
        }

        await tripAttendanceApi.create(createBody, multipartConfig);
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
      setLoading(false);
    }
  };

  const tripMeta = formData.daily_trip_assignment_id
    ? dailyTripAssignmentMeta[formData.daily_trip_assignment_id]
    : undefined;
  const isVehicleLocked = Boolean(isEdit || (tripMeta?.vehicle_id && formData.daily_trip_assignment_id));

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.trip_attendance.title_edit")
            : t("admin.trip_attendance.title_add")
        }
        desc={t("admin.trip_attendance.subtitle")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {showField("daily_trip_assignment_id") && (
            <div>
              <Label>{t("admin.trip_attendance.daily_trip_assignment")}</Label>
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
            )}

            {showField("staff_id") && (
            <div>
              <Label>{t("admin.trip_attendance.staff")}</Label>
              <Select
                value={formData.staff_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, staff_id: value }))}
                options={staffOptions}
                placeholder={t("common.select_option")}
                disabled={fetching || isEdit}
                required
              />
            </div>
            )}

            {showField("vehicle_id") && (
            <div>
              <Label>{t("admin.trip_attendance.vehicle")}</Label>
              <Select
                value={formData.vehicle_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, vehicle_id: value }))}
                options={vehicles}
                placeholder={t("common.select_option")}
                disabled={fetching || isVehicleLocked}
                required
              />
            </div>
            )}

            {showField("attendance_time") && (
            <div>
              <Label>{t("admin.trip_attendance.attendance_time")}</Label>
              <Input
                type="datetime-local"
                value={toDateTimeLocal(formData.attendance_time)}
                disabled
                className="bg-gray-100"
              />
            </div>
            )}

            {showField("latitude") && (
            <div>
              <Label>{t("admin.trip_attendance.latitude")}</Label>
              <Input
                type="number"
                value={formData.latitude}
                onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
                placeholder={t("admin.trip_attendance.latitude")}
              />
            </div>
            )}

            {showField("longitude") && (
            <div>
              <Label>{t("admin.trip_attendance.longitude")}</Label>
              <Input
                type="number"
                value={formData.longitude}
                onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
                placeholder={t("admin.trip_attendance.longitude")}
              />
            </div>
            )}

            {showField("source") && (
            <div>
              <Label>{t("admin.trip_attendance.source")}</Label>
              <Select
                value={formData.source}
                onChange={(value) => setFormData((prev) => ({ ...prev, source: value }))}
                options={sourceOptions.map((option) => ({
                  value: option.value,
                  label:
                    option.value === "MOBILE"
                      ? t("admin.trip_attendance.source_mobile")
                      : t("admin.trip_attendance.source_vehicle_cam"),
                }))}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>
            )}

            {showField("photo") && (
            <div className="md:col-span-2">
              <Label>{t("admin.trip_attendance.photo")}</Label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400"
                  >
                    {t("admin.staff_creation.photo_choose")}
                  </button>
                  <span className="text-sm text-gray-500">
                    {photoFile?.name || t("admin.staff_creation.photo_none")}
                  </span>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) {
                      setPhotoFile(null);
                      return;
                    }
                    if (!file.type.startsWith("image/")) {
                      Swal.fire(
                        t("admin.staff_creation.invalid_photo_title"),
                        t("admin.staff_creation.invalid_photo_desc"),
                        "warning"
                      );
                      event.target.value = "";
                      setPhotoFile(null);
                      return;
                    }
                    setPhotoFile(file);
                  }}
                />
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={t("admin.trip_attendance.photo")}
                    className="h-24 w-24 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed text-xs text-gray-500">
                    {t("admin.staff_creation.photo_none")}
                  </div>
                )}
              </div>
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
